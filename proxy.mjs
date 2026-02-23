/**
 * True — Combined Reverse Proxy
 * 
 * Single entrypoint that serves both Next.js (web UI) and the relay
 * (WebSocket + HTTP API) on one port. Required for platforms like Railway
 * that only expose a single port per service.
 * 
 * Architecture:
 *   Client → proxy:PORT → Next.js (internal:3000) for web pages
 *                        → Relay (internal:3001) for WS + /rooms/* + /health
 */

import { createServer, request } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = parseInt(process.env.PORT || '8080')

// Internal ports — must not conflict with the external PORT or each other
let NEXT_PORT = 3000
let RELAY_PORT = parseInt(process.env.RELAY_PORT || '4001')

// Resolve conflicts: Railway may assign PORT that collides with internal ports
if (NEXT_PORT === PORT) NEXT_PORT = 3002
if (RELAY_PORT === PORT) RELAY_PORT = PORT === 4001 ? 4002 : 4001
if (RELAY_PORT === NEXT_PORT) RELAY_PORT = NEXT_PORT + 1

console.log(`[true] Starting True services...`)
console.log(`[true] External port: ${PORT} | Next.js: ${NEXT_PORT} | Relay: ${RELAY_PORT}`)

// ── Start internal services ──────────────────────────────────────────

const relay = spawn('node', ['relay/dist/relay/server.js'], {
  env: { ...process.env, RELAY_PORT: String(RELAY_PORT) },
  stdio: 'inherit',
})

// In Docker (combined stage), server.js is at root. Locally, it's at .next/standalone/server.js
const nextServerPath = existsSync(resolve('server.js'))
  ? 'server.js'
  : '.next/standalone/server.js'

console.log(`[true] Next.js server: ${nextServerPath}`)

const next = spawn('node', [nextServerPath], {
  env: { ...process.env, PORT: String(NEXT_PORT), HOSTNAME: '0.0.0.0' },
  stdio: 'inherit',
})

// ── Routing logic ────────────────────────────────────────────────────

function isRelayRoute(url) {
  return (
    url === '/health' ||
    url.startsWith('/rooms')
  )
}

// ── HTTP Proxy ───────────────────────────────────────────────────────

const server = createServer((req, res) => {
  const targetPort = isRelayRoute(req.url) ? RELAY_PORT : NEXT_PORT

  const proxyReq = request(
    {
      hostname: '127.0.0.1',
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('error', (err) => {
    console.error(`[proxy] HTTP error → port ${targetPort}: ${err.message}`)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Service unavailable' }))
    }
  })

  req.pipe(proxyReq)
})

// ── WebSocket Proxy (all upgrades → relay) ───────────────────────────

server.on('upgrade', (req, socket, head) => {
  const proxyReq = request({
    hostname: '127.0.0.1',
    port: RELAY_PORT,
    path: req.url || '/',
    method: 'GET',
    headers: req.headers,
  })

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    // Forward the 101 response
    let response = 'HTTP/1.1 101 Switching Protocols\r\n'
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value) response += `${key}: ${value}\r\n`
    }
    response += '\r\n'
    socket.write(response)

    if (proxyHead && proxyHead.length > 0) {
      socket.write(proxyHead)
    }

    // Bidirectional pipe
    proxySocket.pipe(socket)
    socket.pipe(proxySocket)

    proxySocket.on('error', () => socket.destroy())
    socket.on('error', () => proxySocket.destroy())
    proxySocket.on('end', () => socket.end())
    socket.on('end', () => proxySocket.end())
  })

  proxyReq.on('error', (err) => {
    console.error(`[proxy] WS upgrade error: ${err.message}`)
    socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    socket.destroy()
  })

  proxyReq.end()
})

// ── Service health checks ────────────────────────────────────────────

async function waitForService(port, name, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = request(
          { hostname: '127.0.0.1', port, path: '/', method: 'GET', timeout: 2000 },
          (res) => { res.resume(); resolve() }
        )
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
        req.end()
      })
      console.log(`[true] ✓ ${name} ready (port ${port})`)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error(`${name} failed to start on port ${port}`)
}

// ── Start proxy after services are ready ─────────────────────────────

try {
  await waitForService(RELAY_PORT, 'Relay')
  await waitForService(NEXT_PORT, 'Next.js')

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[true] ✓ Proxy listening on port ${PORT}`)
    console.log(`[true] ✓ All services running`)
    console.log(`[true]   Web UI:    http://0.0.0.0:${PORT}`)
    console.log(`[true]   Relay WS:  ws://0.0.0.0:${PORT} (proxied)`)
    console.log(`[true]   Relay API: http://0.0.0.0:${PORT}/rooms (proxied)`)
    console.log(`[true]   Health:    http://0.0.0.0:${PORT}/health (proxied)`)
  })
} catch (err) {
  console.error(`[true] ✗ Failed to start: ${err.message}`)
  relay.kill()
  next.kill()
  process.exit(1)
}

// ── Graceful shutdown ────────────────────────────────────────────────

let isShuttingDown = false

function shutdown(signal) {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`[true] ${signal} — shutting down...`)
  relay.kill('SIGTERM')
  next.kill('SIGTERM')
  server.close(() => {
    console.log('[true] Shutdown complete')
    process.exit(0)
  })
  setTimeout(() => {
    console.warn('[true] Forced shutdown after timeout')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

relay.on('exit', (code) => {
  if (code !== 0 && !isShuttingDown) {
    console.error(`[true] Relay crashed (code ${code}), shutting down`)
    shutdown('relay-crash')
  }
})

next.on('exit', (code) => {
  if (code !== 0 && !isShuttingDown) {
    console.error(`[true] Next.js crashed (code ${code}), shutting down`)
    shutdown('next-crash')
  }
})
