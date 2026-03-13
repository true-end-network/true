/**
 * api-marketplace.test.ts
 *
 * Tests for all Next.js API route handlers under /api/marketplace/.
 * The marketplace store and crypto utils are fully mocked so no filesystem
 * or WebSocket I/O occurs.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Use vi.hoisted so mock objects are available inside vi.mock() factories,
// which are hoisted to the top of the file before const declarations.
// ---------------------------------------------------------------------------

const { mockStore, mockHashSecret, mockCheckRateLimit } = vi.hoisted(() => {
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
  const mockHashSecret = vi.fn((s: string) => `hashed:${s}`)
  const mockCheckRateLimit = vi.fn(() => true)
  return { mockStore, mockHashSecret, mockCheckRateLimit }
})

vi.mock('@/lib/marketplace-store', () => ({
  default: mockStore,
  hashSecret: mockHashSecret,
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/crypto', () => ({
  generateRoomCode: vi.fn(() => 'TESTROOM12AB'),
}))

// ---------------------------------------------------------------------------
// Import route handlers after mocks are in place
// ---------------------------------------------------------------------------

import {
  GET as packsGET,
  POST as packsPOST,
} from '../src/app/api/marketplace/packs/route'

import {
  GET as packByIdGET,
  PATCH as packByIdPATCH,
  DELETE as packByIdDELETE,
} from '../src/app/api/marketplace/packs/[id]/route'

import {
  GET as sessionsGET,
  POST as sessionsPOST,
} from '../src/app/api/marketplace/sessions/route'

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
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
  })
}

type RouteParams = { params: Promise<{ id: string }> }

function makeParams(id: string): RouteParams {
  return { params: Promise.resolve({ id }) }
}

const NOW = '2025-01-01T00:00:00.000Z'

function makeSamplePack(id = 'pack-001') {
  return {
    id,
    mentorName: 'Major',
    mentorSecret: `hashed:secret123`,
    title: 'DeFi Mastery',
    description: 'Learn DeFi',
    category: 'defi',
    skills: ['Yield Farming'],
    pricing: { type: 'one-time', amount: 99, currency: 'USDT' },
    metrics: { tvl: '50k' },
    rating: 0,
    reviewCount: 0,
    totalSessions: 0,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function makeSampleSession(id = 'session-001') {
  return {
    id,
    packId: 'pack-001',
    roomCode: 'TESTROOM12AB',
    mentorJoined: false,
    menteeJoined: false,
    status: 'waiting' as const,
    startedAt: NOW,
  }
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockReturnValue(true)
  mockHashSecret.mockImplementation((s: string) => `hashed:${s}`)

  // Default store responses
  mockStore.getPacks.mockResolvedValue([])
  mockStore.getPack.mockResolvedValue(undefined)
  mockStore.addPack.mockResolvedValue(undefined)
  mockStore.updatePack.mockResolvedValue(undefined)
  mockStore.deletePack.mockResolvedValue(true)
  mockStore.getSessions.mockResolvedValue([])
  mockStore.getSession.mockResolvedValue(undefined)
  mockStore.addSession.mockResolvedValue(undefined)
  mockStore.updateSession.mockResolvedValue(undefined)
  mockStore.getPackReviews.mockResolvedValue([])
  mockStore.addReview.mockResolvedValue(undefined)
  mockStore.getStats.mockResolvedValue({
    totalPacks: 0,
    totalSessions: 0,
    activeSessions: 0,
    completedSessions: 0,
    topCategories: [],
  })
})

// ===========================================================================
// POST /api/marketplace/packs
// ===========================================================================

describe('POST /api/marketplace/packs', () => {
  it('creates a pack and returns 201 with safe pack data', async () => {
    const req = makeRequest('POST', '/api/marketplace/packs', {
      mentorName: 'Major',
      mentorSecret: 'secret123',
      title: 'DeFi Mastery',
      description: 'Learn DeFi',
      category: 'defi',
      skills: ['Yield Farming'],
      pricing: { type: 'one-time', amount: 99, currency: 'USDT' },
      metrics: { tvl: '50k' },
    })

    const res = await packsPOST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.title).toBe('DeFi Mastery')
    expect(body.data.mentorSecret).toBeUndefined() // secret must be stripped
    expect(mockStore.addPack).toHaveBeenCalledTimes(1)
    // Verify secret is hashed before storing
    const storedPack = mockStore.addPack.mock.calls[0][0]
    expect(storedPack.mentorSecret).toBe('hashed:secret123')
  })

  it('returns 400 when required fields are missing', async () => {
    const req = makeRequest('POST', '/api/marketplace/packs', {
      mentorName: 'Major',
      // missing mentorSecret, title, description, category, skills, pricing
    })
    const res = await packsPOST(req)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toContain('Missing required fields')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest(new URL('/api/marketplace/packs', 'http://localhost'), {
      method: 'POST',
      body: 'not json{{{',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    })
    const res = await packsPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('POST', '/api/marketplace/packs', {
      mentorName: 'M', mentorSecret: 's', title: 'T', description: 'D',
      category: 'defi', skills: [], pricing: {},
    })
    const res = await packsPOST(req)
    expect(res.status).toBe(429)
  })

  it('converts non-array skills to empty array', async () => {
    const req = makeRequest('POST', '/api/marketplace/packs', {
      mentorName: 'Major', mentorSecret: 'secret',
      title: 'T', description: 'D', category: 'defi',
      skills: 'not-an-array',
      pricing: { type: 'one-time', amount: 50, currency: 'USD' },
    })
    const res = await packsPOST(req)
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.data.skills).toEqual([])
  })
})

// ===========================================================================
// GET /api/marketplace/packs
// ===========================================================================

describe('GET /api/marketplace/packs', () => {
  it('returns all packs with mentorSecret stripped', async () => {
    const packs = [makeSamplePack('p1'), makeSamplePack('p2')]
    mockStore.getPacks.mockResolvedValue(packs)

    const req = makeRequest('GET', '/api/marketplace/packs')
    const res = await packsGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].mentorSecret).toBeUndefined()
  })

  it('filters packs by category', async () => {
    const packs = [
      { ...makeSamplePack('p1'), category: 'defi' },
      { ...makeSamplePack('p2'), category: 'trading' },
    ]
    mockStore.getPacks.mockResolvedValue(packs)

    const req = makeRequest('GET', '/api/marketplace/packs?category=defi')
    const res = await packsGET(req)
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].category).toBe('defi')
  })

  it('filters packs by minPrice', async () => {
    const packs = [
      { ...makeSamplePack('p1'), pricing: { type: 'one-time', amount: 10, currency: 'USD' } },
      { ...makeSamplePack('p2'), pricing: { type: 'one-time', amount: 100, currency: 'USD' } },
    ]
    mockStore.getPacks.mockResolvedValue(packs)

    const req = makeRequest('GET', '/api/marketplace/packs?minPrice=50')
    const res = await packsGET(req)
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('p2')
  })

  it('sorts packs by rating when sort=rating', async () => {
    const packs = [
      { ...makeSamplePack('p1'), rating: 3 },
      { ...makeSamplePack('p2'), rating: 5 },
    ]
    mockStore.getPacks.mockResolvedValue(packs)

    const req = makeRequest('GET', '/api/marketplace/packs?sort=rating')
    const res = await packsGET(req)
    const body = await res.json()

    expect(body.data[0].rating).toBe(5)
    expect(body.data[1].rating).toBe(3)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('GET', '/api/marketplace/packs')
    const res = await packsGET(req)
    expect(res.status).toBe(429)
  })
})

// ===========================================================================
// GET /api/marketplace/packs/:id
// ===========================================================================

describe('GET /api/marketplace/packs/:id', () => {
  it('returns pack details with reviews', async () => {
    const pack = makeSamplePack()
    const reviews = [{ sessionId: 's1', rating: 5, comment: 'Great', menteeName: 'Alice', createdAt: NOW }]
    mockStore.getPack.mockResolvedValue(pack)
    mockStore.getPackReviews.mockResolvedValue(reviews)

    const req = makeRequest('GET', '/api/marketplace/packs/pack-001')
    const res = await packByIdGET(req, makeParams('pack-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.id).toBe('pack-001')
    expect(body.data.reviews).toHaveLength(1)
    expect(body.data.mentorSecret).toBeUndefined()
  })

  it('returns 404 for unknown pack id', async () => {
    mockStore.getPack.mockResolvedValue(undefined)
    const req = makeRequest('GET', '/api/marketplace/packs/nope')
    const res = await packByIdGET(req, makeParams('nope'))
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('GET', '/api/marketplace/packs/any')
    const res = await packByIdGET(req, makeParams('any'))
    expect(res.status).toBe(429)
  })
})

// ===========================================================================
// PATCH /api/marketplace/packs/:id
// ===========================================================================

describe('PATCH /api/marketplace/packs/:id', () => {
  it('updates pack when correct mentorSecret is provided', async () => {
    const pack = makeSamplePack()
    const updated = { ...pack, title: 'Updated Title', updatedAt: new Date().toISOString() }
    mockStore.getPack.mockResolvedValue(pack)
    mockStore.updatePack.mockResolvedValue(updated)

    const req = makeRequest('PATCH', '/api/marketplace/packs/pack-001', {
      mentorSecret: 'secret123',
      title: 'Updated Title',
    })
    const res = await packByIdPATCH(req, makeParams('pack-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.title).toBe('Updated Title')
    expect(body.data.mentorSecret).toBeUndefined()
  })

  it('returns 403 when mentorSecret is wrong', async () => {
    const pack = makeSamplePack()
    mockStore.getPack.mockResolvedValue(pack)
    mockHashSecret.mockReturnValue('wrong-hash')

    const req = makeRequest('PATCH', '/api/marketplace/packs/pack-001', {
      mentorSecret: 'wrong',
      title: 'Hacked',
    })
    const res = await packByIdPATCH(req, makeParams('pack-001'))
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown pack', async () => {
    mockStore.getPack.mockResolvedValue(undefined)
    const req = makeRequest('PATCH', '/api/marketplace/packs/ghost', {
      mentorSecret: 'x', title: 'Y',
    })
    const res = await packByIdPATCH(req, makeParams('ghost'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when mentorSecret is missing', async () => {
    const pack = makeSamplePack()
    mockStore.getPack.mockResolvedValue(pack)
    const req = makeRequest('PATCH', '/api/marketplace/packs/pack-001', {
      title: 'No secret',
    })
    const res = await packByIdPATCH(req, makeParams('pack-001'))
    expect(res.status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('PATCH', '/api/marketplace/packs/pack-001', { mentorSecret: 'x' })
    const res = await packByIdPATCH(req, makeParams('pack-001'))
    expect(res.status).toBe(429)
  })
})

// ===========================================================================
// DELETE /api/marketplace/packs/:id
// ===========================================================================

describe('DELETE /api/marketplace/packs/:id', () => {
  it('deletes pack when correct mentorSecret is provided', async () => {
    const pack = makeSamplePack()
    mockStore.getPack.mockResolvedValue(pack)
    mockStore.deletePack.mockResolvedValue(true)

    const req = makeRequest('DELETE', '/api/marketplace/packs/pack-001', {
      mentorSecret: 'secret123',
    })
    const res = await packByIdDELETE(req, makeParams('pack-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.id).toBe('pack-001')
    expect(mockStore.deletePack).toHaveBeenCalledWith('pack-001')
  })

  it('returns 403 when mentorSecret is wrong', async () => {
    const pack = makeSamplePack()
    mockStore.getPack.mockResolvedValue(pack)
    mockHashSecret.mockReturnValue('bad-hash')

    const req = makeRequest('DELETE', '/api/marketplace/packs/pack-001', { mentorSecret: 'bad' })
    const res = await packByIdDELETE(req, makeParams('pack-001'))
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown pack', async () => {
    mockStore.getPack.mockResolvedValue(undefined)
    const req = makeRequest('DELETE', '/api/marketplace/packs/nope', { mentorSecret: 'x' })
    const res = await packByIdDELETE(req, makeParams('nope'))
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('DELETE', '/api/marketplace/packs/p', { mentorSecret: 'x' })
    const res = await packByIdDELETE(req, makeParams('p'))
    expect(res.status).toBe(429)
  })
})

// ===========================================================================
// POST /api/marketplace/sessions
// ===========================================================================

describe('POST /api/marketplace/sessions', () => {
  it('creates a session with room code when pack exists', async () => {
    const pack = makeSamplePack()
    mockStore.getPack.mockResolvedValue(pack)
    mockStore.updatePack.mockResolvedValue({ ...pack, totalSessions: 1 })

    const req = makeRequest('POST', '/api/marketplace/sessions', { packId: 'pack-001' })
    const res = await sessionsPOST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.packId).toBe('pack-001')
    expect(body.data.roomCode).toBe('TESTROOM12AB')
    expect(body.data.status).toBe('waiting')
    expect(mockStore.addSession).toHaveBeenCalledTimes(1)
    expect(mockStore.updatePack).toHaveBeenCalledWith('pack-001', { totalSessions: 1 })
  })

  it('returns 400 when packId is missing', async () => {
    const req = makeRequest('POST', '/api/marketplace/sessions', {})
    const res = await sessionsPOST(req)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('packId')
  })

  it('returns 404 when pack does not exist', async () => {
    mockStore.getPack.mockResolvedValue(undefined)
    const req = makeRequest('POST', '/api/marketplace/sessions', { packId: 'ghost' })
    const res = await sessionsPOST(req)
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest(new URL('/api/marketplace/sessions', 'http://localhost'), {
      method: 'POST',
      body: '{invalid',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    })
    const res = await sessionsPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('POST', '/api/marketplace/sessions', { packId: 'p' })
    const res = await sessionsPOST(req)
    expect(res.status).toBe(429)
  })
})

// ===========================================================================
// GET /api/marketplace/sessions
// ===========================================================================

describe('GET /api/marketplace/sessions', () => {
  it('returns all sessions sorted newest first', async () => {
    const sessions = [
      { ...makeSampleSession('s1'), startedAt: '2025-01-01T00:00:00Z' },
      { ...makeSampleSession('s2'), startedAt: '2025-02-01T00:00:00Z' },
    ]
    mockStore.getSessions.mockResolvedValue(sessions)

    const req = makeRequest('GET', '/api/marketplace/sessions')
    const res = await sessionsGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].id).toBe('s2') // newest first
  })

  it('filters by status', async () => {
    const sessions = [
      { ...makeSampleSession('s1'), status: 'waiting' },
      { ...makeSampleSession('s2'), status: 'completed' },
    ]
    mockStore.getSessions.mockResolvedValue(sessions)

    const req = makeRequest('GET', '/api/marketplace/sessions?status=completed')
    const res = await sessionsGET(req)
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].status).toBe('completed')
  })

  it('filters by packId', async () => {
    const sessions = [
      { ...makeSampleSession('s1'), packId: 'pack-001' },
      { ...makeSampleSession('s2'), packId: 'pack-002' },
    ]
    mockStore.getSessions.mockResolvedValue(sessions)

    const req = makeRequest('GET', '/api/marketplace/sessions?packId=pack-001')
    const res = await sessionsGET(req)
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].packId).toBe('pack-001')
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('GET', '/api/marketplace/sessions')
    const res = await sessionsGET(req)
    expect(res.status).toBe(429)
  })
})

// ===========================================================================
// GET /api/marketplace/sessions/:id
// ===========================================================================

describe('GET /api/marketplace/sessions/:id', () => {
  it('returns session by id', async () => {
    const session = makeSampleSession()
    mockStore.getSession.mockResolvedValue(session)

    const req = makeRequest('GET', '/api/marketplace/sessions/session-001')
    const res = await sessionByIdGET(req, makeParams('session-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe('session-001')
    expect(body.data.roomCode).toBe('TESTROOM12AB')
  })

  it('returns 404 for unknown session', async () => {
    mockStore.getSession.mockResolvedValue(undefined)
    const req = makeRequest('GET', '/api/marketplace/sessions/nope')
    const res = await sessionByIdGET(req, makeParams('nope'))
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('GET', '/api/marketplace/sessions/s')
    const res = await sessionByIdGET(req, makeParams('s'))
    expect(res.status).toBe(429)
  })
})

// ===========================================================================
// PATCH /api/marketplace/sessions/:id (status transitions)
// ===========================================================================

describe('PATCH /api/marketplace/sessions/:id', () => {
  it('transitions session from waiting to active', async () => {
    const session = makeSampleSession()
    const updated = { ...session, status: 'active' as const, mentorJoined: true }
    mockStore.getSession.mockResolvedValue(session)
    mockStore.updateSession.mockResolvedValue(updated)

    const req = makeRequest('PATCH', '/api/marketplace/sessions/session-001', {
      status: 'active',
      mentorJoined: true,
    })
    const res = await sessionByIdPATCH(req, makeParams('session-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.status).toBe('active')
  })

  it('sets completedAt when status transitions to completed', async () => {
    const session = makeSampleSession({ status: 'active' })
    const updated = { ...session, status: 'completed' as const, completedAt: NOW }
    mockStore.getSession.mockResolvedValue(session)
    mockStore.updateSession.mockResolvedValue(updated)

    const req = makeRequest('PATCH', '/api/marketplace/sessions/session-001', {
      status: 'completed',
    })
    const res = await sessionByIdPATCH(req, makeParams('session-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    // updateSession should have been called with completedAt
    const updateArg = mockStore.updateSession.mock.calls[0][1]
    expect(updateArg.completedAt).toBeDefined()
  })

  it('returns 400 for invalid status', async () => {
    const session = makeSampleSession()
    mockStore.getSession.mockResolvedValue(session)

    const req = makeRequest('PATCH', '/api/marketplace/sessions/session-001', {
      status: 'invalid-status',
    })
    const res = await sessionByIdPATCH(req, makeParams('session-001'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown session', async () => {
    mockStore.getSession.mockResolvedValue(undefined)
    const req = makeRequest('PATCH', '/api/marketplace/sessions/nope', { status: 'active' })
    const res = await sessionByIdPATCH(req, makeParams('nope'))
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('PATCH', '/api/marketplace/sessions/s', {})
    const res = await sessionByIdPATCH(req, makeParams('s'))
    expect(res.status).toBe(429)
  })
})

// ===========================================================================
// POST /api/marketplace/sessions/:id/review
// ===========================================================================

describe('POST /api/marketplace/sessions/:id/review', () => {
  it('submits a review for a completed session', async () => {
    const session = { ...makeSampleSession(), status: 'completed' as const, completedAt: NOW }
    mockStore.getSession.mockResolvedValue(session)
    mockStore.getPackReviews.mockResolvedValue([])
    mockStore.updatePack.mockResolvedValue({ ...makeSamplePack(), rating: 5, reviewCount: 1 })

    const req = makeRequest('POST', '/api/marketplace/sessions/session-001/review', {
      rating: 5,
      comment: 'Excellent knowledge transfer!',
      menteeName: 'Alice',
    })
    const res = await reviewPOST(req, makeParams('session-001'))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.rating).toBe(5)
    expect(body.data.comment).toBe('Excellent knowledge transfer!')
    expect(mockStore.addReview).toHaveBeenCalledTimes(1)
    expect(mockStore.updatePack).toHaveBeenCalledTimes(1)
  })

  it('recalculates average rating after submission', async () => {
    const session = { ...makeSampleSession(), status: 'completed' as const }
    mockStore.getSession.mockResolvedValue(session)
    // The route calls getPackReviews once AFTER adding the new review.
    // Return the full combined list (existing 3-star + new 5-star).
    mockStore.getPackReviews.mockResolvedValue([
      { sessionId: 's0', rating: 3, comment: 'ok', menteeName: 'Bob', createdAt: NOW },
      { sessionId: 'session-001', rating: 5, comment: 'Great', menteeName: 'Alice', createdAt: NOW },
    ])

    const req = makeRequest('POST', '/api/marketplace/sessions/session-001/review', {
      rating: 5,
      comment: 'Great',
      menteeName: 'Alice',
    })
    await reviewPOST(req, makeParams('session-001'))

    const updateCall = mockStore.updatePack.mock.calls[0][1]
    expect(updateCall.rating).toBe(4) // (3+5)/2 = 4
    expect(updateCall.reviewCount).toBe(2)
  })

  it('returns 400 if session is not completed', async () => {
    const session = makeSampleSession({ status: 'waiting' })
    mockStore.getSession.mockResolvedValue(session)

    const req = makeRequest('POST', '/api/marketplace/sessions/session-001/review', {
      rating: 5, comment: 'Great', menteeName: 'Alice',
    })
    const res = await reviewPOST(req, makeParams('session-001'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('completed')
  })

  it('returns 400 for rating out of range', async () => {
    const session = { ...makeSampleSession(), status: 'completed' as const }
    mockStore.getSession.mockResolvedValue(session)

    const req = makeRequest('POST', '/api/marketplace/sessions/session-001/review', {
      rating: 6, comment: 'Too high', menteeName: 'Alice',
    })
    const res = await reviewPOST(req, makeParams('session-001'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing required review fields', async () => {
    const session = { ...makeSampleSession(), status: 'completed' as const }
    mockStore.getSession.mockResolvedValue(session)

    const req = makeRequest('POST', '/api/marketplace/sessions/session-001/review', {
      rating: 5,
      // missing comment and menteeName
    })
    const res = await reviewPOST(req, makeParams('session-001'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown session', async () => {
    mockStore.getSession.mockResolvedValue(undefined)
    const req = makeRequest('POST', '/api/marketplace/sessions/ghost/review', {
      rating: 5, comment: 'x', menteeName: 'y',
    })
    const res = await reviewPOST(req, makeParams('ghost'))
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('POST', '/api/marketplace/sessions/s/review', {})
    const res = await reviewPOST(req, makeParams('s'))
    expect(res.status).toBe(429)
  })
})

// ===========================================================================
// GET /api/marketplace/sessions/:id/review
// ===========================================================================

describe('GET /api/marketplace/sessions/:id/review', () => {
  it('returns reviews for this session', async () => {
    const session = { ...makeSampleSession(), status: 'completed' as const }
    const reviews = [
      { sessionId: 'session-001', rating: 5, comment: 'Great', menteeName: 'Alice', createdAt: NOW },
      { sessionId: 'session-999', rating: 4, comment: 'Good', menteeName: 'Bob', createdAt: NOW },
    ]
    mockStore.getSession.mockResolvedValue(session)
    mockStore.getPackReviews.mockResolvedValue(reviews)

    const req = makeRequest('GET', '/api/marketplace/sessions/session-001/review')
    const res = await reviewGET(req, makeParams('session-001'))
    const body = await res.json()

    expect(res.status).toBe(200)
    // Only session-001 review should be returned
    expect(body.data).toHaveLength(1)
    expect(body.data[0].menteeName).toBe('Alice')
  })

  it('returns 404 for unknown session', async () => {
    mockStore.getSession.mockResolvedValue(undefined)
    const req = makeRequest('GET', '/api/marketplace/sessions/ghost/review')
    const res = await reviewGET(req, makeParams('ghost'))
    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// GET /api/marketplace/stats
// ===========================================================================

describe('GET /api/marketplace/stats', () => {
  it('returns marketplace statistics', async () => {
    const stats = {
      totalPacks: 10,
      totalSessions: 25,
      activeSessions: 3,
      completedSessions: 20,
      topCategories: [{ name: 'defi', count: 5 }],
    }
    mockStore.getStats.mockResolvedValue(stats)

    const req = makeRequest('GET', '/api/marketplace/stats')
    const res = await statsGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.totalPacks).toBe(10)
    expect(body.data.topCategories[0].name).toBe('defi')
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue(false)
    const req = makeRequest('GET', '/api/marketplace/stats')
    const res = await statsGET(req)
    expect(res.status).toBe(429)
  })
})
