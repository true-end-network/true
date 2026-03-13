/**
 * marketplace-store.ts
 *
 * In-memory store with JSON file persistence for the True Academy marketplace.
 * Uses fs/promises for async I/O. Default export is the store object.
 */

import { createHash, randomUUID } from "crypto"
import { writeFile, readFile, mkdir } from "fs/promises"
import { join } from "path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PackListing {
  id: string
  mentorName: string
  mentorSecret: string      // stored as SHA-256 hash — never expose raw value
  title: string
  description: string
  category: string
  skills: string[]
  pricing: Record<string, unknown>
  metrics: Record<string, string>
  rating: number            // 0-5, recalculated from reviews
  reviewCount: number
  totalSessions: number
  createdAt: string         // ISO
  updatedAt: string
}

export interface MentorSession {
  id: string
  packId: string
  roomCode: string
  mentorJoined: boolean
  menteeJoined: boolean
  status: "waiting" | "active" | "completed" | "expired" | "cancelled"
  startedAt: string         // ISO
  completedAt?: string
}

export interface Review {
  sessionId: string
  rating: number            // 1-5
  comment: string
  menteeName: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), ".data")
const DATA_FILE = join(DATA_DIR, "marketplace.json")

interface PersistedData {
  packs: Record<string, PackListing>
  sessions: Record<string, MentorSession>
  reviews: Record<string, Review[]>
}

const packs = new Map<string, PackListing>()
const sessions = new Map<string, MentorSession>()
const reviews = new Map<string, Review[]>()   // keyed by packId

// Lazy-load: populated on first access
let loadPromise: Promise<void> | null = null

async function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = load()
  return loadPromise
}

async function load(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true })
    const raw = await readFile(DATA_FILE, "utf-8")
    const data = JSON.parse(raw) as PersistedData
    if (data.packs) {
      for (const [id, pack] of Object.entries(data.packs)) packs.set(id, pack)
    }
    if (data.sessions) {
      for (const [id, session] of Object.entries(data.sessions)) sessions.set(id, session)
    }
    if (data.reviews) {
      for (const [packId, list] of Object.entries(data.reviews)) reviews.set(packId, list)
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    // ENOENT is fine — start with an empty store
  }
}

async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const data: PersistedData = {
    packs: Object.fromEntries(packs),
    sessions: Object.fromEntries(sessions),
    reviews: Object.fromEntries(reviews),
  }
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8")
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic SHA-256 hash — 64 hex characters.
 * Same input always produces the same output (no salt by design for this store).
 */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const DEFAULT_LIMIT = 100
const DEFAULT_WINDOW_MS = 60_000

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Key is the IP address only (no action namespace).
 */
export function checkRateLimit(
  ip: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS
): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

// ---------------------------------------------------------------------------
// Pack CRUD
// ---------------------------------------------------------------------------

async function getPacks(): Promise<PackListing[]> {
  await ensureLoaded()
  return Array.from(packs.values())
}

async function getPack(id: string): Promise<PackListing | undefined> {
  await ensureLoaded()
  return packs.get(id)
}

async function addPack(pack: PackListing): Promise<void> {
  await ensureLoaded()
  packs.set(pack.id, pack)
  await persist()
}

async function updatePack(
  id: string,
  updates: Partial<PackListing>
): Promise<PackListing | undefined> {
  await ensureLoaded()
  const pack = packs.get(id)
  if (!pack) return undefined
  const updated: PackListing = {
    ...pack,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  packs.set(id, updated)
  await persist()
  return updated
}

async function deletePack(id: string): Promise<boolean> {
  await ensureLoaded()
  const existed = packs.has(id)
  packs.delete(id)
  if (existed) await persist()
  return existed
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

async function getSessions(): Promise<MentorSession[]> {
  await ensureLoaded()
  return Array.from(sessions.values())
}

async function getSession(id: string): Promise<MentorSession | undefined> {
  await ensureLoaded()
  return sessions.get(id)
}

async function addSession(session: MentorSession): Promise<void> {
  await ensureLoaded()
  sessions.set(session.id, session)
  await persist()
}

async function updateSession(
  id: string,
  updates: Partial<MentorSession>
): Promise<MentorSession | undefined> {
  await ensureLoaded()
  const session = sessions.get(id)
  if (!session) return undefined
  const updated: MentorSession = { ...session, ...updates }
  sessions.set(id, updated)
  await persist()
  return updated
}

// ---------------------------------------------------------------------------
// Reviews — stored keyed by packId
// ---------------------------------------------------------------------------

async function getPackReviews(packId: string): Promise<Review[]> {
  await ensureLoaded()
  return reviews.get(packId) ?? []
}

async function addReview(packId: string, review: Review): Promise<void> {
  await ensureLoaded()
  const list = reviews.get(packId) ?? []
  list.push(review)
  reviews.set(packId, list)
  await persist()
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

async function getStats(): Promise<{
  totalPacks: number
  totalSessions: number
  activeSessions: number
  completedSessions: number
  topCategories: { name: string; count: number }[]
}> {
  await ensureLoaded()
  const allPacks = Array.from(packs.values())
  const allSessions = Array.from(sessions.values())

  const catMap: Record<string, number> = {}
  for (const p of allPacks) {
    catMap[p.category] = (catMap[p.category] ?? 0) + 1
  }

  return {
    totalPacks: allPacks.length,
    totalSessions: allSessions.length,
    activeSessions: allSessions.filter(
      s => s.status === "active" || s.status === "waiting"
    ).length,
    completedSessions: allSessions.filter(s => s.status === "completed").length,
    topCategories: Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
  }
}

// ---------------------------------------------------------------------------
// Default export — store object
// ---------------------------------------------------------------------------

const store = {
  getPacks,
  getPack,
  addPack,
  updatePack,
  deletePack,
  getSessions,
  getSession,
  addSession,
  updateSession,
  getPackReviews,
  addReview,
  getStats,
}

/** Explicit type alias for the store, referenced by tests via import().default */
export type Store = typeof store

export { store as default }
