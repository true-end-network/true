import { createHash } from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PackListing {
  id: string
  mentorName: string
  mentorSecret: string
  title: string
  description: string
  category: string
  skills: string[]
  pricing: { type: string; amount: number; currency: string }
  metrics: Record<string, string>
  rating: number
  reviewCount: number
  totalSessions: number
  createdAt: string
  updatedAt: string
}

export interface MentorSession {
  id: string
  packId: string
  roomCode: string
  mentorJoined: boolean
  menteeJoined: boolean
  status: 'waiting' | 'active' | 'completed'
  startedAt: string
  completedAt?: string
}

export interface Review {
  sessionId: string
  rating: number
  comment: string
  menteeName: string
  createdAt: string
}

interface StoreData {
  packs: PackListing[]
  sessions: MentorSession[]
  reviews: Record<string, Review[]>
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function hashSecret(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

export function checkRateLimit(ip: string, limit = 30, windowMs = 60000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count += 1
  return true
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const DATA_FILE = path.resolve('.marketplace-data.json')

async function loadFromDisk(): Promise<StoreData> {
  try {
    const raw = await readFile(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as StoreData
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { packs: [], sessions: [], reviews: {} }
    }
    throw err
  }
}

async function saveToDisk(data: StoreData): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

let loaded = false
const packsMap = new Map<string, PackListing>()
const sessionsMap = new Map<string, MentorSession>()
const reviewsMap = new Map<string, Review[]>()

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  loaded = true
  const data = await loadFromDisk()
  for (const pack of data.packs) {
    packsMap.set(pack.id, pack)
  }
  for (const session of data.sessions) {
    sessionsMap.set(session.id, session)
  }
  for (const [packId, reviews] of Object.entries(data.reviews)) {
    reviewsMap.set(packId, reviews)
  }
}

function toStoreData(): StoreData {
  return {
    packs: Array.from(packsMap.values()),
    sessions: Array.from(sessionsMap.values()),
    reviews: Object.fromEntries(reviewsMap.entries()),
  }
}

async function persist(): Promise<void> {
  await saveToDisk(toStoreData())
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const store = {
  async getPacks(): Promise<PackListing[]> {
    await ensureLoaded()
    return Array.from(packsMap.values())
  },

  async getPack(id: string): Promise<PackListing | undefined> {
    await ensureLoaded()
    return packsMap.get(id)
  },

  async addPack(pack: PackListing): Promise<void> {
    await ensureLoaded()
    packsMap.set(pack.id, pack)
    await persist()
  },

  async updatePack(id: string, updates: Partial<PackListing>): Promise<PackListing | undefined> {
    await ensureLoaded()
    const existing = packsMap.get(id)
    if (!existing) return undefined
    const updated: PackListing = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    packsMap.set(id, updated)
    await persist()
    return updated
  },

  async deletePack(id: string): Promise<boolean> {
    await ensureLoaded()
    if (!packsMap.has(id)) return false
    packsMap.delete(id)
    await persist()
    return true
  },

  async getSessions(): Promise<MentorSession[]> {
    await ensureLoaded()
    return Array.from(sessionsMap.values())
  },

  async getSession(id: string): Promise<MentorSession | undefined> {
    await ensureLoaded()
    return sessionsMap.get(id)
  },

  async addSession(session: MentorSession): Promise<void> {
    await ensureLoaded()
    sessionsMap.set(session.id, session)
    await persist()
  },

  async updateSession(id: string, updates: Partial<MentorSession>): Promise<MentorSession | undefined> {
    await ensureLoaded()
    const existing = sessionsMap.get(id)
    if (!existing) return undefined
    const updated: MentorSession = { ...existing, ...updates }
    sessionsMap.set(id, updated)
    await persist()
    return updated
  },

  async getPackReviews(packId: string): Promise<Review[]> {
    await ensureLoaded()
    return reviewsMap.get(packId) ?? []
  },

  async addReview(packId: string, review: Review): Promise<void> {
    await ensureLoaded()
    const existing = reviewsMap.get(packId) ?? []
    reviewsMap.set(packId, [...existing, review])
    await persist()
  },

  async getStats(): Promise<{
    totalPacks: number
    totalSessions: number
    activeSessions: number
    completedSessions: number
    topCategories: { name: string; count: number }[]
  }> {
    await ensureLoaded()
    const packs = Array.from(packsMap.values())
    const sessions = Array.from(sessionsMap.values())

    const totalPacks = packs.length
    const totalSessions = sessions.length
    const activeSessions = sessions.filter(s => s.status === 'waiting' || s.status === 'active').length
    const completedSessions = sessions.filter(s => s.status === 'completed').length

    const categoryCounts = new Map<string, number>()
    for (const pack of packs) {
      categoryCounts.set(pack.category, (categoryCounts.get(pack.category) ?? 0) + 1)
    }

    const topCategories = Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return { totalPacks, totalSessions, activeSessions, completedSessions, topCategories }
  },
}

export default store
