import { createServer, type IncomingMessage, type ServerResponse } from "http"
import { WebSocketServer, WebSocket } from "ws"
import pino from "pino"
import {
  RELAY_PORT,
  HEARTBEAT_INTERVAL,
  ROOM_CLEANUP_INTERVAL,
  MAX_MESSAGE_SIZE,
  MAX_ROOM_TTL,
  MESSAGE_BUFFER_SIZE,
  MAX_ROOMS,
  MAX_PEERS_PER_ROOM,
  HTTP_PEER_TIMEOUT,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_CREATE,
  RATE_LIMIT_JOIN,
  RATE_LIMIT_MESSAGE,
  CORS_ORIGIN,
} from "../src/lib/constants"
import type {
  ClientEvent,
  ServerEvent,
  MessagePayload,
  Envelope,
} from "../src/lib/protocol"

const log = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino/file", options: { destination: 1 } },
  }),
})

const TRUSTED_PROXIES = parseInt(process.env.TRUSTED_PROXIES || "0", 10)

interface Peer {
  ws: WebSocket
  id: string
  alive: boolean
}

interface Room {
  hash: string
  peers: Map<string, Peer>
  httpPeers: Map<string, number>
  messageBuffer: Envelope[]
  deleteToken: string
  createdAt: number
  ttl: number
}

interface RateWindow {
  creates: number
  joins: number
  messages: number
  windowStart: number
}

const rooms = new Map<string, Room>()
const wsToRooms = new Map<WebSocket, Set<string>>()
const wsToIp = new Map<WebSocket, string>()
const rateLimits = new Map<string, RateWindow>()

function generateTempId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("base64url")
}

function getClientIp(req: IncomingMessage): string {
  if (TRUSTED_PROXIES > 0) {
    const forwarded = req.headers["x-forwarded-for"]
    if (typeof forwarded === "string") {
      const parts = forwarded.split(",").map((s) => s.trim())
      const clientIndex = Math.max(0, parts.length - TRUSTED_PROXIES)
      return parts[clientIndex] || req.socket.remoteAddress || "unknown"
    }
  }
  return req.socket.remoteAddress || "unknown"
}

function getRateWindow(ip: string): RateWindow {
  const now = Date.now()
  let window = rateLimits.get(ip)
  if (!window || now - window.windowStart > RATE_LIMIT_WINDOW) {
    window = { creates: 0, joins: 0, messages: 0, windowStart: now }
    rateLimits.set(ip, window)
  }
  return window
}

function checkRate(ip: string, action: "creates" | "joins" | "messages"): boolean {
  const limits = { creates: RATE_LIMIT_CREATE, joins: RATE_LIMIT_JOIN, messages: RATE_LIMIT_MESSAGE }
  const window = getRateWindow(ip)
  if (window[action] >= limits[action]) return false
  window[action]++
  return true
}

function send(ws: WebSocket, data: ServerEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function broadcast(room: Room, data: ServerEvent, excludeId?: string) {
  for (const [id, peer] of room.peers) {
    if (id !== excludeId) {
      send(peer.ws, data)
    }
  }
}

function pushToBuffer(room: Room, envelope: Envelope) {
  room.messageBuffer.push(envelope)
  if (room.messageBuffer.length > MESSAGE_BUFFER_SIZE) {
    room.messageBuffer.shift()
  }
}

function totalPeerCount(room: Room): number {
  return room.peers.size + room.httpPeers.size
}

function trackWsRoom(ws: WebSocket, roomHash: string) {
  let set = wsToRooms.get(ws)
  if (!set) {
    set = new Set()
    wsToRooms.set(ws, set)
  }
  set.add(roomHash)
}

function untrackWsRoom(ws: WebSocket, roomHash: string) {
  const set = wsToRooms.get(ws)
  if (set) {
    set.delete(roomHash)
    if (set.size === 0) wsToRooms.delete(ws)
  }
}

function removePeerFromAllRooms(ws: WebSocket) {
  const roomHashes = wsToRooms.get(ws)
  if (!roomHashes) return

  for (const hash of roomHashes) {
    const room = rooms.get(hash)
    if (!room) continue

    for (const [id, peer] of room.peers) {
      if (peer.ws === ws) {
        room.peers.delete(id)
        broadcast(room, {
          event: "peer_left",
          roomHash: hash,
          peerId: id,
          peerCount: totalPeerCount(room),
        })
        if (room.peers.size === 0 && room.httpPeers.size === 0) {
          rooms.delete(hash)
        }
        break
      }
    }
  }

  wsToRooms.delete(ws)
  wsToIp.delete(ws)
}

function validateEnvelope(envelope: unknown): envelope is Envelope {
  if (!envelope || typeof envelope !== "object") return false
  const e = envelope as Record<string, unknown>
  return (
    typeof e.room === "string" &&
    typeof e.from === "string" &&
    typeof e.payload === "string" &&
    typeof e.nonce === "string" &&
    typeof e.ts === "number" &&
    e.room.length > 0 &&
    e.payload.length > 0 &&
    e.nonce.length > 0
  )
}

function handleCreateRoom(ws: WebSocket, data: { ttl: number; roomHash: string }, ip: string) {
  const { ttl, roomHash } = data

  if (!checkRate(ip, "creates")) {
    send(ws, { event: "error", message: "Rate limit exceeded", code: "RATE_LIMITED", roomHash })
    return
  }

  if (rooms.size >= MAX_ROOMS) {
    send(ws, { event: "error", message: "Service at capacity", code: "CAPACITY_EXCEEDED", roomHash })
    return
  }

  if (rooms.has(roomHash)) {
    send(ws, { event: "error", message: "Operation failed", code: "ROOM_ERROR", roomHash })
    return
  }

  const clampedTtl = Math.min(Math.max(ttl, 60), MAX_ROOM_TTL)
  const peerId = generateTempId()
  const deleteToken = generateTempId()

  const room: Room = {
    hash: roomHash,
    peers: new Map(),
    httpPeers: new Map(),
    messageBuffer: [],
    deleteToken,
    createdAt: Date.now(),
    ttl: clampedTtl * 1000,
  }

  room.peers.set(peerId, { ws, id: peerId, alive: true })
  rooms.set(roomHash, room)
  trackWsRoom(ws, roomHash)

  send(ws, { event: "room_created", roomHash, peerId, deleteToken })
}

function handleJoinRoom(ws: WebSocket, data: { roomHash: string }, ip: string) {
  const { roomHash } = data

  if (!checkRate(ip, "joins")) {
    send(ws, { event: "error", message: "Rate limit exceeded", code: "RATE_LIMITED", roomHash })
    return
  }

  const room = rooms.get(roomHash)

  if (!room) {
    send(ws, { event: "error", message: "Operation failed", code: "ROOM_ERROR", roomHash })
    return
  }

  if (totalPeerCount(room) >= MAX_PEERS_PER_ROOM) {
    send(ws, { event: "error", message: "Room is full", code: "ROOM_FULL", roomHash })
    return
  }

  const peerId = generateTempId()
  room.peers.set(peerId, { ws, id: peerId, alive: true })
  trackWsRoom(ws, roomHash)

  send(ws, {
    event: "room_joined",
    roomHash,
    peerId,
    peerCount: totalPeerCount(room),
  })

  broadcast(
    room,
    {
      event: "peer_joined",
      roomHash,
      peerId,
      peerCount: totalPeerCount(room),
    },
    peerId
  )
}

function handleLeaveRoom(ws: WebSocket, data: { roomHash: string }) {
  const { roomHash } = data
  const room = rooms.get(roomHash)
  if (!room) return

  for (const [id, peer] of room.peers) {
    if (peer.ws === ws) {
      room.peers.delete(id)
      untrackWsRoom(ws, roomHash)
      broadcast(room, {
        event: "peer_left",
        roomHash,
        peerId: id,
        peerCount: totalPeerCount(room),
      })
      if (room.peers.size === 0 && room.httpPeers.size === 0) {
        rooms.delete(roomHash)
      }
      break
    }
  }
}

function handleDeleteRoom(ws: WebSocket, data: { roomHash: string; deleteToken: string }) {
  const { roomHash, deleteToken } = data
  const room = rooms.get(roomHash)

  if (!room) {
    send(ws, { event: "error", message: "Operation failed", code: "ROOM_ERROR" })
    return
  }

  if (!deleteToken || room.deleteToken !== deleteToken) {
    send(ws, { event: "error", message: "Invalid delete token", code: "INVALID_DELETE_TOKEN" })
    return
  }

  broadcast(room, { event: "room_deleted", roomHash })

  for (const peer of room.peers.values()) {
    untrackWsRoom(peer.ws, roomHash)
    peer.ws.close(1000, "Room deleted")
  }

  rooms.delete(roomHash)
}

function handleMessage(ws: WebSocket, data: { envelope: unknown }, ip: string) {
  if (!checkRate(ip, "messages")) {
    send(ws, { event: "error", message: "Rate limit exceeded", code: "RATE_LIMITED" })
    return
  }

  if (!validateEnvelope(data.envelope)) {
    send(ws, { event: "error", message: "Invalid envelope", code: "INVALID_ENVELOPE" })
    return
  }

  const envelope = data.envelope
  const room = rooms.get(envelope.room)

  if (!room) {
    send(ws, { event: "error", message: "Operation failed", code: "ROOM_ERROR" })
    return
  }

  let senderFound = false
  for (const peer of room.peers.values()) {
    if (peer.ws === ws) {
      senderFound = true
      break
    }
  }

  if (!senderFound) {
    send(ws, { event: "error", message: "Not in room", code: "NOT_IN_ROOM" })
    return
  }

  pushToBuffer(room, envelope)

  const messageData: MessagePayload = { event: "message", envelope }

  for (const peer of room.peers.values()) {
    if (peer.ws !== ws) {
      send(peer.ws, messageData)
    }
  }
}

function cleanupExpiredRooms() {
  const now = Date.now()
  for (const [hash, room] of rooms) {
    if (now - room.createdAt > room.ttl) {
      broadcast(room, { event: "room_expired", roomHash: hash })
      for (const peer of room.peers.values()) {
        untrackWsRoom(peer.ws, hash)
        peer.ws.close(1000, "Room expired")
      }
      rooms.delete(hash)
      continue
    }

    for (const [peerId, lastSeen] of room.httpPeers) {
      if (now - lastSeen > HTTP_PEER_TIMEOUT) {
        room.httpPeers.delete(peerId)
        broadcast(room, {
          event: "peer_left",
          roomHash: hash,
          peerId,
          peerCount: totalPeerCount(room),
        })
      }
    }

    if (room.peers.size === 0 && room.httpPeers.size === 0) {
      rooms.delete(hash)
    }
  }

  for (const [ip, window] of rateLimits) {
    if (now - window.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimits.delete(ip)
    }
  }
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Delete-Token",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  }
}

function jsonResponse(res: ServerResponse, status: number, body: Record<string, unknown>) {
  res.writeHead(status, { "Content-Type": "application/json", ...corsHeaders() })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString()
      if (body.length > MAX_MESSAGE_SIZE) {
        req.destroy()
        reject(new Error("Body too large"))
      }
    })
    req.on("end", () => resolve(body))
    req.on("error", reject)
  })
}

function parseRoute(url: string): { path: string; hash: string | null; action: string | null; query: URLSearchParams } {
  const parsed = new URL(url, "http://localhost")
  const parts = parsed.pathname.split("/").filter(Boolean)

  if (parts[0] !== "rooms") {
    return { path: parsed.pathname, hash: null, action: null, query: parsed.searchParams }
  }

  return {
    path: parsed.pathname,
    hash: parts[1] || null,
    action: parts[2] || null,
    query: parsed.searchParams,
  }
}

function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
  const ip = getClientIp(req)

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  const route = parseRoute(req.url || "/")

  if (route.path === "/health") {
    let wsPeers = 0
    let httpPeers = 0
    for (const room of rooms.values()) {
      wsPeers += room.peers.size
      httpPeers += room.httpPeers.size
    }
    const mem = process.memoryUsage()
    jsonResponse(res, 200, {
      status: "ok",
      uptime: Math.floor(process.uptime()),
      rooms: rooms.size,
      peers: { ws: wsPeers, http: httpPeers, total: wsPeers + httpPeers },
      memory: { rss: Math.floor(mem.rss / 1048576), heap: Math.floor(mem.heapUsed / 1048576) },
      limits: { maxRooms: MAX_ROOMS, maxPeersPerRoom: MAX_PEERS_PER_ROOM },
    })
    return
  }

  if (!route.hash && route.path === "/rooms" && req.method === "POST") {
    handleHttpCreateRoom(req, res, ip)
    return
  }

  if (route.hash && !route.action && req.method === "DELETE") {
    handleHttpDeleteRoom(req, res, route.hash)
    return
  }

  if (route.hash && route.action) {
    switch (route.action) {
      case "join":
        if (req.method === "POST") return handleHttpJoinRoom(res, route.hash, ip)
        break
      case "send":
        if (req.method === "POST") return handleHttpSendMessage(req, res, route.hash, ip)
        break
      case "poll":
        if (req.method === "GET") return handleHttpPollMessages(res, route.hash, route.query)
        break
      case "leave":
        if (req.method === "POST") return handleHttpLeaveRoom(req, res, route.hash)
        break
    }
  }

  jsonResponse(res, 404, { error: "Not found" })
}

async function handleHttpCreateRoom(req: IncomingMessage, res: ServerResponse, ip: string) {
  try {
    if (!checkRate(ip, "creates")) {
      jsonResponse(res, 429, { error: "Rate limit exceeded", code: "RATE_LIMITED" })
      return
    }

    if (rooms.size >= MAX_ROOMS) {
      jsonResponse(res, 503, { error: "Service at capacity", code: "CAPACITY_EXCEEDED" })
      return
    }

    const body = JSON.parse(await readBody(req))
    const { roomHash, ttl } = body

    if (!roomHash || typeof roomHash !== "string") {
      jsonResponse(res, 400, { error: "roomHash is required" })
      return
    }

    if (rooms.has(roomHash)) {
      jsonResponse(res, 409, { error: "Operation failed", code: "ROOM_ERROR" })
      return
    }

    const clampedTtl = Math.min(Math.max(ttl || 3600, 60), MAX_ROOM_TTL)
    const peerId = generateTempId()
    const deleteToken = generateTempId()

    const room: Room = {
      hash: roomHash,
      peers: new Map(),
      httpPeers: new Map([[peerId, Date.now()]]),
      messageBuffer: [],
      deleteToken,
      createdAt: Date.now(),
      ttl: clampedTtl * 1000,
    }

    rooms.set(roomHash, room)

    jsonResponse(res, 201, { roomHash, peerId, deleteToken, peerCount: totalPeerCount(room) })
  } catch (err) {
    log.warn({ err, path: "/rooms" }, "invalid http create request")
    jsonResponse(res, 400, { error: "Invalid request body" })
  }
}

function handleHttpJoinRoom(res: ServerResponse, roomHash: string, ip: string) {
  if (!checkRate(ip, "joins")) {
    jsonResponse(res, 429, { error: "Rate limit exceeded", code: "RATE_LIMITED" })
    return
  }

  const room = rooms.get(roomHash)

  if (!room) {
    jsonResponse(res, 404, { error: "Operation failed", code: "ROOM_ERROR" })
    return
  }

  if (totalPeerCount(room) >= MAX_PEERS_PER_ROOM) {
    jsonResponse(res, 403, { error: "Room is full", code: "ROOM_FULL" })
    return
  }

  const peerId = generateTempId()
  room.httpPeers.set(peerId, Date.now())

  broadcast(room, {
    event: "peer_joined",
    roomHash,
    peerId,
    peerCount: totalPeerCount(room),
  })

  jsonResponse(res, 200, { roomHash, peerId, peerCount: totalPeerCount(room) })
}

async function handleHttpSendMessage(req: IncomingMessage, res: ServerResponse, roomHash: string, ip: string) {
  try {
    if (!checkRate(ip, "messages")) {
      jsonResponse(res, 429, { error: "Rate limit exceeded", code: "RATE_LIMITED" })
      return
    }

    const body = JSON.parse(await readBody(req))
    const { envelope, peerId } = body

    if (!validateEnvelope(envelope)) {
      jsonResponse(res, 400, { error: "Invalid envelope" })
      return
    }

    const room = rooms.get(roomHash)
    if (!room) {
      jsonResponse(res, 404, { error: "Operation failed", code: "ROOM_ERROR" })
      return
    }

    const isWsPeer = Array.from(room.peers.values()).some((p) => p.id === peerId)
    const isHttpPeer = room.httpPeers.has(peerId)

    if (!isWsPeer && !isHttpPeer) {
      jsonResponse(res, 403, { error: "Not in room", code: "NOT_IN_ROOM" })
      return
    }

    if (isHttpPeer) {
      room.httpPeers.set(peerId, Date.now())
    }

    pushToBuffer(room, envelope)

    const messageData: MessagePayload = { event: "message", envelope }
    for (const peer of room.peers.values()) {
      send(peer.ws, messageData)
    }

    jsonResponse(res, 200, { sent: true })
  } catch (err) {
    log.warn({ err, path: "send" }, "invalid http send request")
    jsonResponse(res, 400, { error: "Invalid request body" })
  }
}

function handleHttpPollMessages(res: ServerResponse, roomHash: string, query: URLSearchParams) {
  const room = rooms.get(roomHash)

  if (!room) {
    jsonResponse(res, 404, { error: "Operation failed", code: "ROOM_ERROR" })
    return
  }

  const since = parseInt(query.get("since") || "0", 10)
  const peerId = query.get("peerId")

  if (peerId && room.httpPeers.has(peerId)) {
    room.httpPeers.set(peerId, Date.now())
  }

  const messages = room.messageBuffer.filter((e) => e.ts > since)

  jsonResponse(res, 200, {
    messages,
    peerCount: totalPeerCount(room),
    roomHash,
  })
}

async function handleHttpDeleteRoom(req: IncomingMessage, res: ServerResponse, roomHash: string) {
  const room = rooms.get(roomHash)

  if (!room) {
    jsonResponse(res, 404, { error: "Operation failed", code: "ROOM_ERROR" })
    return
  }

  const deleteToken = req.headers["x-delete-token"] as string

  if (!deleteToken || room.deleteToken !== deleteToken) {
    jsonResponse(res, 403, { error: "Invalid delete token", code: "INVALID_DELETE_TOKEN" })
    return
  }

  broadcast(room, { event: "room_deleted", roomHash })

  for (const peer of room.peers.values()) {
    untrackWsRoom(peer.ws, roomHash)
    peer.ws.close(1000, "Room deleted")
  }

  rooms.delete(roomHash)

  jsonResponse(res, 200, { deleted: true })
}

async function handleHttpLeaveRoom(req: IncomingMessage, res: ServerResponse, roomHash: string) {
  try {
    const body = JSON.parse(await readBody(req))
    const { peerId } = body

    const room = rooms.get(roomHash)
    if (!room) {
      jsonResponse(res, 404, { error: "Operation failed", code: "ROOM_ERROR" })
      return
    }

    if (room.httpPeers.has(peerId)) {
      room.httpPeers.delete(peerId)

      broadcast(room, {
        event: "peer_left",
        roomHash,
        peerId,
        peerCount: totalPeerCount(room),
      })

      if (room.peers.size === 0 && room.httpPeers.size === 0) {
        rooms.delete(roomHash)
      }

      jsonResponse(res, 200, { left: true })
    } else {
      jsonResponse(res, 404, { error: "Peer not found" })
    }
  } catch (err) {
    log.warn({ err, path: "leave" }, "invalid http leave request")
    jsonResponse(res, 400, { error: "Invalid request body" })
  }
}

const server = createServer(handleHttpRequest)

const wss = new WebSocketServer({
  server,
  maxPayload: MAX_MESSAGE_SIZE,
})

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const ip = getClientIp(req)
  wsToIp.set(ws, ip)
  ;(ws as WebSocket & { isAlive: boolean }).isAlive = true

  ws.on("pong", () => {
    (ws as WebSocket & { isAlive: boolean }).isAlive = true
  })

  ws.on("message", (raw: Buffer) => {
    try {
      const data = JSON.parse(raw.toString()) as ClientEvent
      const clientIp = wsToIp.get(ws) || "unknown"

      switch (data.event) {
        case "create_room":
          handleCreateRoom(ws, data, clientIp)
          break
        case "join_room":
          handleJoinRoom(ws, data, clientIp)
          break
        case "leave_room":
          handleLeaveRoom(ws, data)
          break
        case "delete_room":
          handleDeleteRoom(ws, data)
          break
        case "message":
          handleMessage(ws, data, clientIp)
          break
        case "ping":
          send(ws, { event: "pong" })
          break
      }
    } catch (err) {
      log.warn({ err, ip }, "invalid ws message format")
      send(ws, { event: "error", message: "Invalid message format", code: "INVALID_FORMAT" })
    }
  })

  ws.on("close", () => {
    removePeerFromAllRooms(ws)
  })

  ws.on("error", (err) => {
    log.warn({ err, ip }, "ws connection error")
    removePeerFromAllRooms(ws)
  })
})

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = ws as WebSocket & { isAlive: boolean }
    if (!client.isAlive) {
      removePeerFromAllRooms(ws)
      return ws.terminate()
    }
    client.isAlive = false
    ws.ping()
  })
}, HEARTBEAT_INTERVAL)

const cleanup = setInterval(cleanupExpiredRooms, ROOM_CLEANUP_INTERVAL)

server.on("close", () => {
  clearInterval(heartbeat)
  clearInterval(cleanup)
})

server.listen(RELAY_PORT, () => {
  log.info({ port: RELAY_PORT, protocols: ["ws", "http"], maxRooms: MAX_ROOMS, maxPeersPerRoom: MAX_PEERS_PER_ROOM }, "relay server started")
  log.info("zero-log mode: no message content is stored or logged")
})

let isShuttingDown = false

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true

  let peerCount = 0
  for (const room of rooms.values()) {
    peerCount += totalPeerCount(room)
  }
  log.info({ signal, rooms: rooms.size, peers: peerCount }, "shutting down, draining connections")

  clearInterval(heartbeat)
  clearInterval(cleanup)

  for (const [hash, room] of rooms) {
    broadcast(room, { event: "room_expired", roomHash: hash })
    for (const peer of room.peers.values()) {
      peer.ws.close(1001, "Server shutting down")
    }
  }
  rooms.clear()

  wss.close(() => {
    server.close(() => {
      log.info("shutdown complete")
      process.exit(0)
    })
  })

  setTimeout(() => {
    log.warn("forced shutdown after timeout")
    process.exit(1)
  }, 5000)
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"))
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
