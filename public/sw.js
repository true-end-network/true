/// True PWA Service Worker
/// Provides offline support, caching, and background sync

const CACHE_VERSION = "true-v1"
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const OFFLINE_URL = "/offline"

// Static assets to precache on install
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/contacts",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.svg",
  "/icon-512.svg",
]

// Install: precache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// Fetch strategies
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") return

  // Skip WebSocket upgrades
  if (url.protocol === "ws:" || url.protocol === "wss:") return

  // Skip external requests
  if (url.origin !== self.location.origin) return

  // Skip API routes — always network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/rooms/")) return

  // Skip health endpoint
  if (url.pathname === "/health") return

  // Static assets: cache-first
  if (
    url.pathname.match(/\.(svg|png|ico|woff2?|ttf|css|js)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // HTML pages: network-first with offline fallback
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstWithOffline(request))
    return
  }

  // Next.js data/RSC: network-first
  if (
    url.pathname.startsWith("/_next/") ||
    url.searchParams.has("_rsc")
  ) {
    event.respondWith(networkFirst(request))
    return
  }

  // Default: network-first
  event.respondWith(networkFirst(request))
})

// Cache-first: try cache, fallback to network (update cache)
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response("", { status: 408, statusText: "Offline" })
  }
}

// Network-first: try network, fallback to cache
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response("", { status: 408, statusText: "Offline" })
  }
}

// Network-first with offline page fallback for navigation
async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    // Fallback to offline page
    const offlinePage = await caches.match(OFFLINE_URL)
    if (offlinePage) return offlinePage

    return new Response(
      "<html><body style='background:#0a0a0a;color:#fafafa;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui'><div style='text-align:center'><h1>True</h1><p>You are offline</p></div></body></html>",
      { headers: { "Content-Type": "text/html" } }
    )
  }
}

// Listen for skip waiting message from client
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
