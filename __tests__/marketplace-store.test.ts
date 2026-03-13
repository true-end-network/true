import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock fs/promises so the store never touches the real filesystem.
// The factory runs once; all tests share the same vi.fn() instances.
// ---------------------------------------------------------------------------
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(
    Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
  ),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Helper types (re-declare so we don't need to import the actual module types
// across reset boundaries)
// ---------------------------------------------------------------------------
import type { PackListing, MentorSession, Review } from '../src/lib/marketplace-store'

// ---------------------------------------------------------------------------
// Per-test fresh store via vi.resetModules() + dynamic import
// ---------------------------------------------------------------------------

let store: import('../src/lib/marketplace-store').default extends infer T ? T : never
let hashSecret: (s: string) => string
let checkRateLimit: (ip: string, limit?: number, windowMs?: number) => boolean

beforeEach(async () => {
  // Clear all mock call history and reset implementations to defaults
  vi.clearAllMocks()
  const { readFile, writeFile, mkdir } = await import('fs/promises')
  vi.mocked(readFile).mockRejectedValue(
    Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
  )
  vi.mocked(writeFile).mockResolvedValue(undefined)
  vi.mocked(mkdir).mockResolvedValue(undefined)

  // Reset the module registry so we get fresh store state (loaded=false, empty maps)
  vi.resetModules()
  const mod = await import('../src/lib/marketplace-store')
  store = mod.default as typeof store
  hashSecret = mod.hashSecret
  checkRateLimit = mod.checkRateLimit
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePack(overrides: Partial<PackListing> = {}): PackListing {
  return {
    id: 'pack-001',
    mentorName: 'Major',
    mentorSecret: 'hashed-secret',
    title: 'Social Media Mastery',
    description: 'Grow your social presence',
    category: 'social-media',
    skills: ['Thread Creation', 'Analytics'],
    pricing: { type: 'one-time', amount: 50, currency: 'USD' },
    metrics: { followers: '14.4K' },
    rating: 0,
    reviewCount: 0,
    totalSessions: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeSession(overrides: Partial<MentorSession> = {}): MentorSession {
  return {
    id: 'session-001',
    packId: 'pack-001',
    roomCode: 'ABCD1234EFGH',
    mentorJoined: false,
    menteeJoined: false,
    status: 'waiting',
    startedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    sessionId: 'session-001',
    rating: 5,
    comment: 'Excellent pack!',
    menteeName: 'Alice',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// hashSecret
// ---------------------------------------------------------------------------

describe('hashSecret', () => {
  it('returns a 64-character hex SHA-256 hash', () => {
    const hash = hashSecret('mysecret')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces the same hash for the same input', () => {
    expect(hashSecret('hello')).toBe(hashSecret('hello'))
  })

  it('produces different hashes for different inputs', () => {
    expect(hashSecret('secretA')).not.toBe(hashSecret('secretB'))
  })

  it('handles empty string', () => {
    const hash = hashSecret('')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('handles unicode input', () => {
    const hash = hashSecret('pässwörд🔑')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  it('allows first request for a new IP', () => {
    expect(checkRateLimit('1.2.3.4')).toBe(true)
  })

  it('allows up to the limit', () => {
    const ip = '5.6.7.8'
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(ip)).toBe(true)
    }
  })

  it('blocks when limit is exceeded', () => {
    const ip = '9.10.11.12'
    for (let i = 0; i < 5; i++) checkRateLimit(ip, 5)
    expect(checkRateLimit(ip, 5)).toBe(false)
  })

  it('respects custom limit', () => {
    const ip = '100.200.0.1'
    expect(checkRateLimit(ip, 2)).toBe(true)
    expect(checkRateLimit(ip, 2)).toBe(true)
    expect(checkRateLimit(ip, 2)).toBe(false)
  })

  it('different IPs have independent counters', () => {
    const ip1 = '10.0.0.1'
    const ip2 = '10.0.0.2'
    for (let i = 0; i < 3; i++) checkRateLimit(ip1, 3)
    // ip1 is now exhausted; ip2 should still be allowed
    expect(checkRateLimit(ip1, 3)).toBe(false)
    expect(checkRateLimit(ip2, 3)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Pack CRUD
// ---------------------------------------------------------------------------

describe('store – Pack CRUD', () => {
  it('getPacks returns empty array initially', async () => {
    const packs = await store.getPacks()
    expect(packs).toEqual([])
  })

  it('addPack persists and getPacks returns it', async () => {
    const pack = makePack()
    await store.addPack(pack)
    const packs = await store.getPacks()
    expect(packs).toHaveLength(1)
    expect(packs[0].id).toBe('pack-001')
  })

  it('getPack returns undefined for unknown id', async () => {
    const result = await store.getPack('nonexistent')
    expect(result).toBeUndefined()
  })

  it('getPack returns the correct pack by id', async () => {
    const pack = makePack()
    await store.addPack(pack)
    const fetched = await store.getPack('pack-001')
    expect(fetched).toBeDefined()
    expect(fetched!.title).toBe('Social Media Mastery')
  })

  it('addPack writes to disk (writeFile called)', async () => {
    const { writeFile } = await import('fs/promises')
    const pack = makePack()
    await store.addPack(pack)
    expect(vi.mocked(writeFile)).toHaveBeenCalled()
  })

  it('updatePack modifies allowed fields and sets updatedAt', async () => {
    const pack = makePack()
    await store.addPack(pack)
    const updated = await store.updatePack('pack-001', { title: 'Updated Title' })
    expect(updated).toBeDefined()
    expect(updated!.title).toBe('Updated Title')
    expect(typeof updated!.updatedAt).toBe('string')
  })

  it('updatePack returns undefined for unknown id', async () => {
    const result = await store.updatePack('ghost', { title: 'X' })
    expect(result).toBeUndefined()
  })

  it('updatePack preserves other fields', async () => {
    const pack = makePack()
    await store.addPack(pack)
    const updated = await store.updatePack('pack-001', { title: 'New Title' })
    expect(updated!.description).toBe(pack.description)
    expect(updated!.mentorName).toBe(pack.mentorName)
  })

  it('deletePack removes the pack and returns true', async () => {
    const pack = makePack()
    await store.addPack(pack)
    const existed = await store.deletePack('pack-001')
    expect(existed).toBe(true)
    expect(await store.getPack('pack-001')).toBeUndefined()
  })

  it('deletePack returns false for unknown id', async () => {
    const result = await store.deletePack('nonexistent')
    expect(result).toBe(false)
  })

  it('can store multiple packs with different ids', async () => {
    await store.addPack(makePack({ id: 'p1', title: 'Pack 1' }))
    await store.addPack(makePack({ id: 'p2', title: 'Pack 2' }))
    const packs = await store.getPacks()
    expect(packs).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

describe('store – Session CRUD', () => {
  it('getSessions returns empty array initially', async () => {
    const sessions = await store.getSessions()
    expect(sessions).toEqual([])
  })

  it('addSession persists and getSessions returns it', async () => {
    await store.addSession(makeSession())
    const sessions = await store.getSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('session-001')
  })

  it('getSession returns undefined for unknown id', async () => {
    expect(await store.getSession('nope')).toBeUndefined()
  })

  it('getSession returns session by id', async () => {
    await store.addSession(makeSession())
    const session = await store.getSession('session-001')
    expect(session).toBeDefined()
    expect(session!.packId).toBe('pack-001')
  })

  it('addSession has generated room code', async () => {
    await store.addSession(makeSession({ roomCode: 'TESTROOM1234' }))
    const session = await store.getSession('session-001')
    expect(session!.roomCode).toBe('TESTROOM1234')
  })

  it('updateSession transitions status: waiting → active', async () => {
    await store.addSession(makeSession({ status: 'waiting' }))
    const updated = await store.updateSession('session-001', { status: 'active' })
    expect(updated!.status).toBe('active')
  })

  it('updateSession transitions status: active → completed', async () => {
    await store.addSession(makeSession({ status: 'active' }))
    const updated = await store.updateSession('session-001', { status: 'completed' })
    expect(updated!.status).toBe('completed')
  })

  it('updateSession sets mentorJoined and menteeJoined', async () => {
    await store.addSession(makeSession())
    const updated = await store.updateSession('session-001', {
      mentorJoined: true,
      menteeJoined: true,
    })
    expect(updated!.mentorJoined).toBe(true)
    expect(updated!.menteeJoined).toBe(true)
  })

  it('updateSession returns undefined for unknown id', async () => {
    const result = await store.updateSession('ghost', { status: 'completed' })
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

describe('store – Reviews', () => {
  it('getPackReviews returns empty array initially', async () => {
    const reviews = await store.getPackReviews('pack-001')
    expect(reviews).toEqual([])
  })

  it('addReview persists and getPackReviews returns it', async () => {
    await store.addReview('pack-001', makeReview())
    const reviews = await store.getPackReviews('pack-001')
    expect(reviews).toHaveLength(1)
    expect(reviews[0].rating).toBe(5)
  })

  it('reviews are keyed by packId (different packs have separate review lists)', async () => {
    await store.addReview('pack-001', makeReview({ rating: 5 }))
    await store.addReview('pack-002', makeReview({ rating: 3 }))
    expect((await store.getPackReviews('pack-001'))[0].rating).toBe(5)
    expect((await store.getPackReviews('pack-002'))[0].rating).toBe(3)
  })

  it('multiple reviews accumulate for the same pack', async () => {
    await store.addReview('pack-001', makeReview({ sessionId: 's1', rating: 5 }))
    await store.addReview('pack-001', makeReview({ sessionId: 's2', rating: 3 }))
    const reviews = await store.getPackReviews('pack-001')
    expect(reviews).toHaveLength(2)
  })

  it('recalculating average rating is consistent with stored reviews', async () => {
    await store.addReview('pack-001', makeReview({ sessionId: 's1', rating: 4 }))
    await store.addReview('pack-001', makeReview({ sessionId: 's2', rating: 2 }))
    const reviews = await store.getPackReviews('pack-001')
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    expect(avg).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

describe('store – Stats', () => {
  it('returns zero counts when store is empty', async () => {
    const stats = await store.getStats()
    expect(stats.totalPacks).toBe(0)
    expect(stats.totalSessions).toBe(0)
    expect(stats.activeSessions).toBe(0)
    expect(stats.completedSessions).toBe(0)
    expect(stats.topCategories).toEqual([])
  })

  it('reflects added packs and sessions', async () => {
    await store.addPack(makePack({ id: 'p1', category: 'social-media' }))
    await store.addPack(makePack({ id: 'p2', category: 'defi' }))
    await store.addSession(makeSession({ id: 's1', status: 'waiting' }))
    await store.addSession(makeSession({ id: 's2', status: 'completed' }))

    const stats = await store.getStats()
    expect(stats.totalPacks).toBe(2)
    expect(stats.totalSessions).toBe(2)
    expect(stats.completedSessions).toBe(1)
    expect(stats.activeSessions).toBe(1)
  })

  it('counts waiting and active sessions as activeSessions', async () => {
    await store.addSession(makeSession({ id: 's1', status: 'waiting' }))
    await store.addSession(makeSession({ id: 's2', status: 'active' }))
    await store.addSession(makeSession({ id: 's3', status: 'completed' }))
    const stats = await store.getStats()
    expect(stats.activeSessions).toBe(2)
    expect(stats.completedSessions).toBe(1)
  })

  it('topCategories is sorted by pack count descending', async () => {
    await store.addPack(makePack({ id: 'p1', category: 'defi' }))
    await store.addPack(makePack({ id: 'p2', category: 'defi' }))
    await store.addPack(makePack({ id: 'p3', category: 'social-media' }))

    const stats = await store.getStats()
    expect(stats.topCategories[0].name).toBe('defi')
    expect(stats.topCategories[0].count).toBe(2)
    expect(stats.topCategories[1].name).toBe('social-media')
    expect(stats.topCategories[1].count).toBe(1)
  })

  it('topCategories returns at most 5 entries', async () => {
    const cats = ['defi', 'social-media', 'trading', 'analytics', 'devops', 'sales']
    for (let i = 0; i < cats.length; i++) {
      await store.addPack(makePack({ id: `p${i}`, category: cats[i] }))
    }
    const stats = await store.getStats()
    expect(stats.topCategories.length).toBeLessThanOrEqual(5)
  })
})
