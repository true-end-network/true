/**
 * api-routes.test.ts
 *
 * Supplementary API route tests focusing on edge cases, error branches,
 * and behaviours not fully covered by api-marketplace.test.ts.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Hoist mock objects so they're available in vi.mock() factories
// ---------------------------------------------------------------------------

const { mockStore, mockHash, mockLimit } = vi.hoisted(() => {
  const mockStore = {
    getPacks: vi.fn(),
    getPack: vi.fn(),
    addPack: vi.fn(),
    updatePack: vi.fn(),
    deletePack: vi.fn(),
    getSessions: vi.fn(),
    getSession: vi.fn(),
    addSession: vi.fn(),
    updateSession: vi.fn(),
    getPackReviews: vi.fn(),
    addReview: vi.fn(),
    getStats: vi.fn(),
  }
  const mockHash = vi.fn((s: string) => `h:${s}`)
  const mockLimit = vi.fn(() => true)
  return { mockStore, mockHash, mockLimit }
})

vi.mock('@/lib/marketplace-store', () => ({
  default: mockStore,
  hashSecret: mockHash,
  checkRateLimit: mockLimit,
}))

vi.mock('@/lib/crypto', () => ({
  generateRoomCode: vi.fn(() => 'ROUTETEST001'),
}))

// ---------------------------------------------------------------------------
// Import handlers
// ---------------------------------------------------------------------------

import { GET as packsGET, POST as packsPOST } from '../src/app/api/marketplace/packs/route'
import {
  GET as packByIdGET,
  PATCH as packByIdPATCH,
  DELETE as packByIdDELETE,
} from '../src/app/api/marketplace/packs/[id]/route'
import { GET as sessionsGET, POST as sessionsPOST } from '../src/app/api/marketplace/sessions/route'
import {
  GET as sessionByIdGET,
  PATCH as sessionByIdPATCH,
} from '../src/app/api/marketplace/sessions/[id]/route'
import {
  POST as reviewPOST,
  GET as reviewGET,
} from '../src/app/api/marketplace/sessions/[id]/review/route'
import { GET as statsGET } from '../src/app/api/marketplace/stats/route'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function req(
  method: string,
  url: string,
  body?: unknown,
  ip = '192.168.1.1'
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
  })
}

type RP = { params: Promise<{ id: string }> }
const p = (id: string): RP => ({ params: Promise.resolve({ id }) })

const NOW = '2025-06-01T00:00:00.000Z'

function samplePack(id = 'p1') {
  return {
    id,
    mentorName: 'Mentor',
    mentorSecret: 'h:topsecret',
    title: 'Pack Title',
    description: 'Pack Description',
    category: 'trading',
    skills: ['skill1'],
    pricing: { type: 'per-session', amount: 25, currency: 'SOL' },
    metrics: {},
    rating: 4.5,
    reviewCount: 2,
    totalSessions: 5,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function sampleSession(id = 's1') {
  return {
    id,
    packId: 'p1',
    roomCode: 'ROUTETEST001',
    mentorJoined: false,
    menteeJoined: false,
    status: 'waiting' as const,
    startedAt: NOW,
  }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockLimit.mockReturnValue(true)
  mockHash.mockImplementation((s: string) => `h:${s}`)
  mockStore.getPacks.mockResolvedValue([])
  mockStore.getPack.mockResolvedValue(undefined)
  mockStore.addPack.mockResolvedValue(undefined)
  mockStore.updatePack.mockResolvedValue(undefined)
  mockStore.deletePack.mockResolvedValue(false)
  mockStore.getSessions.mockResolvedValue([])
  mockStore.getSession.mockResolvedValue(undefined)
  mockStore.addSession.mockResolvedValue(undefined)
  mockStore.updateSession.mockResolvedValue(undefined)
  mockStore.getPackReviews.mockResolvedValue([])
  mockStore.addReview.mockResolvedValue(undefined)
  mockStore.getStats.mockResolvedValue({
    totalPacks: 0, totalSessions: 0,
    activeSessions: 0, completedSessions: 0, topCategories: [],
  })
})

// ===========================================================================
// GET /packs — additional edge cases
// ===========================================================================

describe('GET /api/marketplace/packs — edge cases', () => {
  it('returns 200 with empty array when no packs exist', async () => {
    mockStore.getPacks.mockResolvedValue([])
    const res = await packsGET(req('GET', '/api/marketplace/packs'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
  })

  it('strips mentorSecret from all returned packs', async () => {
    mockStore.getPacks.mockResolvedValue([samplePack('a'), samplePack('b')])
    const res = await packsGET(req('GET', '/api/marketplace/packs'))
    const body = await res.json()
    for (const pack of body.data) {
      expect(pack.mentorSecret).toBeUndefined()
    }
  })

  it('applies both category and minPrice filters simultaneously', async () => {
    mockStore.getPacks.mockResolvedValue([
      { ...samplePack('a'), category: 'trading', pricing: { ...samplePack().pricing, amount: 100 } },
      { ...samplePack('b'), category: 'defi',    pricing: { ...samplePack().pricing, amount: 100 } },
      { ...samplePack('c'), category: 'trading', pricing: { ...samplePack().pricing, amount: 10 } },
    ])
    const res = await packsGET(req('GET', '/api/marketplace/packs?category=trading&minPrice=50'))
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('a')
  })

  it('returns packs unsorted when no sort param', async () => {
    const packs = [
      { ...samplePack('a'), rating: 1 },
      { ...samplePack('b'), rating: 5 },
    ]
    mockStore.getPacks.mockResolvedValue(packs)
    const res = await packsGET(req('GET', '/api/marketplace/packs'))
    const body = await res.json()
    // Order preserved as returned by store (a first)
    expect(body.data[0].id).toBe('a')
  })
})

// ===========================================================================
// POST /packs — additional edge cases
// ===========================================================================

describe('POST /api/marketplace/packs — additional cases', () => {
  it('generates a pack id', async () => {
    const res = await packsPOST(req('POST', '/api/marketplace/packs', {
      mentorName: 'X', mentorSecret: 'sec',
      title: 'T', description: 'D', category: 'sales',
      skills: ['a', 'b'],
      pricing: { type: 'subscription', amount: 10, currency: 'BRL' },
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(typeof body.data.id).toBe('string')
    expect(body.data.id.length).toBeGreaterThan(0)
  })

  it('stores rating=0 and reviewCount=0 by default', async () => {
    const res = await packsPOST(req('POST', '/api/marketplace/packs', {
      mentorName: 'X', mentorSecret: 'sec',
      title: 'T', description: 'D', category: 'analytics',
      skills: [], pricing: { type: 'one-time', amount: 50, currency: 'USD' },
    }))
    const stored = mockStore.addPack.mock.calls[0][0]
    expect(stored.rating).toBe(0)
    expect(stored.reviewCount).toBe(0)
    expect(stored.totalSessions).toBe(0)
  })

  it('returns createdAt and updatedAt timestamps', async () => {
    const res = await packsPOST(req('POST', '/api/marketplace/packs', {
      mentorName: 'X', mentorSecret: 'sec',
      title: 'T', description: 'D', category: 'devops',
      skills: [], pricing: { type: 'per-session', amount: 5, currency: 'ETH' },
    }))
    const body = await res.json()
    expect(body.data.createdAt).toBeTruthy()
    expect(body.data.updatedAt).toBeTruthy()
  })
})

// ===========================================================================
// GET /packs/:id — additional edge cases
// ===========================================================================

describe('GET /api/marketplace/packs/:id — additional cases', () => {
  it('includes an empty reviews array if no reviews exist', async () => {
    mockStore.getPack.mockResolvedValue(samplePack())
    mockStore.getPackReviews.mockResolvedValue([])
    const res = await packByIdGET(req('GET', '/api/marketplace/packs/p1'), p('p1'))
    const body = await res.json()
    expect(Array.isArray(body.data.reviews)).toBe(true)
    expect(body.data.reviews).toHaveLength(0)
  })

  it('returns 200 with correct pack fields', async () => {
    mockStore.getPack.mockResolvedValue(samplePack())
    mockStore.getPackReviews.mockResolvedValue([])
    const res = await packByIdGET(req('GET', '/api/marketplace/packs/p1'), p('p1'))
    const body = await res.json()
    expect(body.data.title).toBe('Pack Title')
    expect(body.data.rating).toBe(4.5)
  })
})

// ===========================================================================
// PATCH /packs/:id — additional edge cases
// ===========================================================================

describe('PATCH /api/marketplace/packs/:id — additional cases', () => {
  it('passes only non-secret fields to updatePack', async () => {
    const pack = samplePack()
    mockStore.getPack.mockResolvedValue(pack)
    mockStore.updatePack.mockResolvedValue({ ...pack, title: 'New' })
    mockHash.mockReturnValue('h:topsecret') // match stored secret

    await packByIdPATCH(req('PATCH', '/api/marketplace/packs/p1', {
      mentorSecret: 'topsecret', title: 'New',
    }), p('p1'))

    const updateArgs = mockStore.updatePack.mock.calls[0][1]
    expect(updateArgs.mentorSecret).toBeUndefined()
  })

  it('returns updated pack without mentorSecret', async () => {
    const pack = samplePack()
    mockStore.getPack.mockResolvedValue(pack)
    mockStore.updatePack.mockResolvedValue({ ...pack, title: 'Updated' })
    mockHash.mockReturnValue('h:topsecret')

    const res = await packByIdPATCH(req('PATCH', '/api/marketplace/packs/p1', {
      mentorSecret: 'topsecret', title: 'Updated',
    }), p('p1'))
    const body = await res.json()
    expect(body.data.mentorSecret).toBeUndefined()
    expect(body.data.title).toBe('Updated')
  })
})

// ===========================================================================
// DELETE /packs/:id — additional edge cases
// ===========================================================================

describe('DELETE /api/marketplace/packs/:id — additional cases', () => {
  it('calls deletePack with the correct id', async () => {
    const pack = samplePack('xyz')
    mockStore.getPack.mockResolvedValue(pack)
    mockStore.deletePack.mockResolvedValue(true)
    mockHash.mockReturnValue('h:topsecret')

    await packByIdDELETE(req('DELETE', '/api/marketplace/packs/xyz', {
      mentorSecret: 'topsecret',
    }), p('xyz'))

    expect(mockStore.deletePack).toHaveBeenCalledWith('xyz')
  })
})

// ===========================================================================
// POST /sessions — additional edge cases
// ===========================================================================

describe('POST /api/marketplace/sessions — additional cases', () => {
  it('session startedAt is an ISO date string', async () => {
    mockStore.getPack.mockResolvedValue(samplePack())
    mockStore.updatePack.mockResolvedValue({ ...samplePack(), totalSessions: 1 })

    const res = await sessionsPOST(req('POST', '/api/marketplace/sessions', { packId: 'p1' }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(() => new Date(body.data.startedAt)).not.toThrow()
  })

  it('new session has mentorJoined=false and menteeJoined=false', async () => {
    mockStore.getPack.mockResolvedValue(samplePack())
    mockStore.updatePack.mockResolvedValue({ ...samplePack(), totalSessions: 1 })

    const res = await sessionsPOST(req('POST', '/api/marketplace/sessions', { packId: 'p1' }))
    const body = await res.json()
    expect(body.data.mentorJoined).toBe(false)
    expect(body.data.menteeJoined).toBe(false)
  })
})

// ===========================================================================
// GET /sessions — additional edge cases
// ===========================================================================

describe('GET /api/marketplace/sessions — additional cases', () => {
  it('returns empty array when no sessions', async () => {
    mockStore.getSessions.mockResolvedValue([])
    const res = await sessionsGET(req('GET', '/api/marketplace/sessions'))
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('sorts sessions newest first by startedAt', async () => {
    mockStore.getSessions.mockResolvedValue([
      { ...sampleSession('s1'), startedAt: '2025-01-01T00:00:00Z' },
      { ...sampleSession('s3'), startedAt: '2025-03-01T00:00:00Z' },
      { ...sampleSession('s2'), startedAt: '2025-02-01T00:00:00Z' },
    ])
    const res = await sessionsGET(req('GET', '/api/marketplace/sessions'))
    const body = await res.json()
    expect(body.data[0].id).toBe('s3')
    expect(body.data[2].id).toBe('s1')
  })
})

// ===========================================================================
// PATCH /sessions/:id — additional edge cases
// ===========================================================================

describe('PATCH /api/marketplace/sessions/:id — additional cases', () => {
  it('allows mentorJoined + menteeJoined updates without status change', async () => {
    const session = sampleSession()
    mockStore.getSession.mockResolvedValue(session)
    mockStore.updateSession.mockResolvedValue({ ...session, mentorJoined: true })

    const res = await sessionByIdPATCH(req('PATCH', '/api/marketplace/sessions/s1', {
      mentorJoined: true,
    }), p('s1'))
    expect(res.status).toBe(200)
  })

  it('completedAt is auto-added when status becomes completed', async () => {
    const session = { ...sampleSession(), status: 'active' as const }
    const completed = { ...session, status: 'completed' as const, completedAt: NOW }
    mockStore.getSession.mockResolvedValue(session)
    mockStore.updateSession.mockResolvedValue(completed)

    await sessionByIdPATCH(req('PATCH', '/api/marketplace/sessions/s1', {
      status: 'completed',
    }), p('s1'))

    const updateArg = mockStore.updateSession.mock.calls[0][1]
    expect(updateArg.completedAt).toBeDefined()
    expect(typeof updateArg.completedAt).toBe('string')
  })

  it('does not set completedAt when transitioning to active', async () => {
    const session = sampleSession()
    mockStore.getSession.mockResolvedValue(session)
    mockStore.updateSession.mockResolvedValue({ ...session, status: 'active' as const })

    await sessionByIdPATCH(req('PATCH', '/api/marketplace/sessions/s1', {
      status: 'active',
    }), p('s1'))

    const updateArg = mockStore.updateSession.mock.calls[0][1]
    expect(updateArg.completedAt).toBeUndefined()
  })
})

// ===========================================================================
// POST /sessions/:id/review — additional edge cases
// ===========================================================================

describe('POST /sessions/:id/review — additional cases', () => {
  it('returns 400 for rating below 1', async () => {
    const session = { ...sampleSession(), status: 'completed' as const }
    mockStore.getSession.mockResolvedValue(session)
    const res = await reviewPOST(req('POST', '/api/marketplace/sessions/s1/review', {
      rating: 0, comment: 'Bad', menteeName: 'Alice',
    }), p('s1'))
    expect(res.status).toBe(400)
  })

  it('submits review with rating=1 (minimum valid)', async () => {
    const session = { ...sampleSession(), status: 'completed' as const, packId: 'p1' }
    mockStore.getSession.mockResolvedValue(session)
    mockStore.getPackReviews.mockResolvedValue([{ sessionId: 's1', rating: 1, comment: 'ok', menteeName: 'Bob', createdAt: NOW }])
    const res = await reviewPOST(req('POST', '/api/marketplace/sessions/s1/review', {
      rating: 1, comment: 'ok', menteeName: 'Bob',
    }), p('s1'))
    expect(res.status).toBe(201)
  })

  it('submits review with rating=5 (maximum valid)', async () => {
    const session = { ...sampleSession(), status: 'completed' as const, packId: 'p1' }
    mockStore.getSession.mockResolvedValue(session)
    mockStore.getPackReviews.mockResolvedValue([{ sessionId: 's1', rating: 5, comment: 'great', menteeName: 'Carol', createdAt: NOW }])
    const res = await reviewPOST(req('POST', '/api/marketplace/sessions/s1/review', {
      rating: 5, comment: 'great', menteeName: 'Carol',
    }), p('s1'))
    expect(res.status).toBe(201)
  })

  it('review response contains sessionId', async () => {
    const session = { ...sampleSession('my-session'), status: 'completed' as const, packId: 'p1' }
    mockStore.getSession.mockResolvedValue(session)
    mockStore.getPackReviews.mockResolvedValue([{ sessionId: 'my-session', rating: 4, comment: 'good', menteeName: 'Dave', createdAt: NOW }])
    const res = await reviewPOST(req('POST', '/api/marketplace/sessions/my-session/review', {
      rating: 4, comment: 'good', menteeName: 'Dave',
    }), p('my-session'))
    const body = await res.json()
    expect(body.data.sessionId).toBe('my-session')
  })
})

// ===========================================================================
// GET /sessions/:id/review — additional edge cases
// ===========================================================================

describe('GET /sessions/:id/review — additional cases', () => {
  it('returns empty array when no reviews for this session', async () => {
    const session = { ...sampleSession(), status: 'completed' as const }
    mockStore.getSession.mockResolvedValue(session)
    mockStore.getPackReviews.mockResolvedValue([
      { sessionId: 'other-session', rating: 5, comment: 'x', menteeName: 'Z', createdAt: NOW },
    ])
    const res = await reviewGET(req('GET', '/api/marketplace/sessions/s1/review'), p('s1'))
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

// ===========================================================================
// GET /stats — additional edge cases
// ===========================================================================

describe('GET /api/marketplace/stats — additional cases', () => {
  it('returns success=true flag', async () => {
    const res = await statsGET(req('GET', '/api/marketplace/stats'))
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns all expected stat fields', async () => {
    mockStore.getStats.mockResolvedValue({
      totalPacks: 5, totalSessions: 12,
      activeSessions: 2, completedSessions: 10,
      topCategories: [{ name: 'defi', count: 3 }],
    })
    const res = await statsGET(req('GET', '/api/marketplace/stats'))
    const body = await res.json()
    expect(body.data).toHaveProperty('totalPacks')
    expect(body.data).toHaveProperty('totalSessions')
    expect(body.data).toHaveProperty('activeSessions')
    expect(body.data).toHaveProperty('completedSessions')
    expect(body.data).toHaveProperty('topCategories')
  })
})
