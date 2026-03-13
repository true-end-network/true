/**
 * e2e-flow.test.ts
 *
 * Full end-to-end integration test that walks through the complete user journey:
 *
 *  1. Mentor creates and validates a knowledge pack
 *  2. Mentor lists pack on marketplace (POST /api/marketplace/packs)
 *  3. Mentee browses packs (GET /api/marketplace/packs)
 *  4. Mentee views pack details (GET /api/marketplace/packs/:id)
 *  5. Mentee starts session (POST /api/marketplace/sessions)
 *  6. MentorAgent delivers pack (mocked WebSocket)
 *  7. MenteeAgent saves to memory (real temp dir)
 *  8. Mentee submits review (POST /api/marketplace/sessions/:id/review)
 *  9. Stats updated (GET /api/marketplace/stats)
 * 10. Pack rating reflects the review
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Mock the store for API route calls.
// We use a real in-memory store-like object (no file I/O) to allow state to
// flow from one step to the next across route handler calls.
// vi.hoisted() is required so these objects are ready when vi.mock() factories run.
// ---------------------------------------------------------------------------

import type { PackListing, MentorSession, Review } from '../src/lib/marketplace-store'

const { inMemoryPacks, inMemorySessions, inMemoryReviews, inMemoryStore, hashSecretImpl } =
  vi.hoisted(() => {
    const inMemoryPacks = new Map<string, PackListing>()
    const inMemorySessions = new Map<string, MentorSession>()
    const inMemoryReviews = new Map<string, Review[]>()

    const hashSecretImpl = (s: string): string => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createHash } = require('crypto')
      return createHash('sha256').update(s).digest('hex')
    }

    const inMemoryStore = {
      getPacks: vi.fn(async () => Array.from(inMemoryPacks.values())),
      getPack: vi.fn(async (id: string) => inMemoryPacks.get(id)),
      addPack: vi.fn(async (pack: PackListing) => {
        inMemoryPacks.set(pack.id, pack)
      }),
      updatePack: vi.fn(async (id: string, updates: Partial<PackListing>) => {
        const pack = inMemoryPacks.get(id)
        if (!pack) return undefined
        const updated = { ...pack, ...updates, updatedAt: new Date().toISOString() }
        inMemoryPacks.set(id, updated)
        return updated
      }),
      deletePack: vi.fn(async (id: string) => {
        const existed = inMemoryPacks.has(id)
        inMemoryPacks.delete(id)
        return existed
      }),
      getSessions: vi.fn(async () => Array.from(inMemorySessions.values())),
      getSession: vi.fn(async (id: string) => inMemorySessions.get(id)),
      addSession: vi.fn(async (session: MentorSession) => {
        inMemorySessions.set(session.id, session)
      }),
      updateSession: vi.fn(async (id: string, updates: Partial<MentorSession>) => {
        const session = inMemorySessions.get(id)
        if (!session) return undefined
        const updated = { ...session, ...updates }
        inMemorySessions.set(id, updated)
        return updated
      }),
      getPackReviews: vi.fn(async (packId: string) => inMemoryReviews.get(packId) ?? []),
      addReview: vi.fn(async (packId: string, review: Review) => {
        const list = inMemoryReviews.get(packId) ?? []
        list.push(review)
        inMemoryReviews.set(packId, list)
      }),
      getStats: vi.fn(async () => {
        const packs = Array.from(inMemoryPacks.values())
        const sessions = Array.from(inMemorySessions.values())
        const catMap: Record<string, number> = {}
        for (const p of packs) catMap[p.category] = (catMap[p.category] ?? 0) + 1
        return {
          totalPacks: packs.length,
          totalSessions: sessions.length,
          activeSessions: sessions.filter((s) => s.status === 'active' || s.status === 'waiting')
            .length,
          completedSessions: sessions.filter((s) => s.status === 'completed').length,
          topCategories: Object.entries(catMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count })),
        }
      }),
    }

    return { inMemoryPacks, inMemorySessions, inMemoryReviews, inMemoryStore, hashSecretImpl }
  })

vi.mock('@/lib/marketplace-store', () => ({
  default: inMemoryStore,
  hashSecret: vi.fn(hashSecretImpl),
  checkRateLimit: vi.fn(() => true),
}))

vi.mock('@/lib/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/crypto')>()
  return {
    ...actual,
    generateRoomCode: vi.fn(() => 'E2EROOM001AA'),
  }
})

// Mock 'ws' so agents don't connect to real WebSocket
vi.mock('ws', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const EventEmitter = require('events').EventEmitter
  class MockWS extends EventEmitter {
    static OPEN = 1
    readyState = 1
    send = vi.fn()
    close = vi.fn()
  }
  return { default: MockWS }
})

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server'

import {
  SkillCategory,
  validateKnowledgePack,
  sanitizeKnowledgePack,
  generatePackId,
  type KnowledgePack,
} from '../src/lib/knowledge-pack'

import { MentorAgent } from '../agent-sdk/mentor'
import { MenteeAgent } from '../agent-sdk/mentee'

import { POST as packsPOST, GET as packsGET } from '../src/app/api/marketplace/packs/route'
import {
  GET as packByIdGET,
} from '../src/app/api/marketplace/packs/[id]/route'
import { POST as sessionsPOST } from '../src/app/api/marketplace/sessions/route'
import { PATCH as sessionByIdPATCH } from '../src/app/api/marketplace/sessions/[id]/route'
import { POST as reviewPOST } from '../src/app/api/marketplace/sessions/[id]/review/route'
import { GET as statsGET } from '../src/app/api/marketplace/stats/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(
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
      'x-forwarded-for': '10.0.0.1',
      ...headers,
    },
  })
}

type Params = { params: Promise<{ id: string }> }
const params = (id: string): Params => ({ params: Promise.resolve({ id }) })

// ---------------------------------------------------------------------------
// Shared pack fixture used throughout the flow
// ---------------------------------------------------------------------------

const MENTOR_SECRET = 'supersecret-mentor-key'

function buildKnowledgePack(): KnowledgePack {
  const base: KnowledgePack = {
    id: '',
    version: '1.2.0',
    title: 'DeFi Yield Mastery',
    description: 'A comprehensive guide to maximizing DeFi yields safely.',
    category: SkillCategory.DeFi,
    mentor: {
      name: 'Major',
      platform: 'OpenClaw',
      specialties: ['DeFi', 'yield-farming', 'risk-management'],
      experience: '6 weeks, 24/7 continuous operation',
      resultsSnapshot: { 'max-yield': '42% APY', 'tvl-managed': '$50k' },
    },
    skills: [
      {
        name: 'Liquidity Pool Basics',
        category: 'defi',
        difficulty: 'beginner',
        content: '# Liquidity Pools\n\nA liquidity pool is a smart contract...',
        examples: ['Uniswap V3 USDC/ETH pool', 'Curve 3pool'],
        pitfalls: ['Impermanent loss', 'Rug pull risk'],
      },
      {
        name: 'Yield Stacking',
        category: 'defi',
        difficulty: 'advanced',
        content: '# Yield Stacking\n\nCombine protocols for compounded returns.',
        examples: ['Convex + Curve', 'Aave + Idle Finance'],
        pitfalls: ['Smart contract composability risk', 'Gas cost erosion'],
      },
    ],
    errorLog: [
      {
        date: '2025-02-14',
        description: 'Ignored slippage tolerance, got sandwiched',
        impact: 'Lost 2% on $10k swap',
        fix: 'Set slippage to 0.5% on DEX trades',
        lesson: 'Always set slippage protection on high-value swaps',
      },
    ],
    workflows: [
      {
        name: 'Daily Yield Audit',
        description: 'Check all active positions for APY changes and rebalance',
        steps: [
          { step: 1, action: 'Open DeFiLlama dashboard' },
          { step: 2, action: 'Compare current vs target APY' },
          { step: 3, action: 'Rebalance if delta > 15%', notes: 'Only when gas < 20 gwei' },
        ],
        triggers: ['Every morning 9am UTC', 'APY drops more than 10%'],
      },
    ],
    toolConfigs: [],
    templates: [],
    metrics: {
      period: '6 weeks',
      metrics: {
        avgApy: { value: '28', unit: '%', change: '+5%' },
        tvl: { value: '50000', unit: 'USD', change: '+20%' },
      },
      verifiable: true,
    },
    pricing: {
      type: 'one-time',
      amount: 150,
      currency: 'USDT',
      trialAvailable: false,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      language: 'en',
      targetAudience: 'DeFi beginners to intermediate users',
      tags: ['defi', 'yield', 'liquidity', 'risk'],
      prerequisites: ['Basic EVM knowledge', 'MetaMask setup'],
    },
  }
  base.id = generatePackId(base)
  return base
}

// ---------------------------------------------------------------------------
// E2E Test Suite
// ---------------------------------------------------------------------------

describe('E2E: Complete Mentor-Mentee Knowledge Transfer Flow', () => {
  let tmpDir: string
  let knowledgePack: KnowledgePack
  let packId: string
  let sessionId: string
  let roomCode: string

  beforeEach(() => {
    // Clear all in-memory state
    inMemoryPacks.clear()
    inMemorySessions.clear()
    inMemoryReviews.clear()
    vi.clearAllMocks()

    // Create a fresh temp directory for mentee memory
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-mentee-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // ─── Step 1: Validate and sanitize the knowledge pack ─────────────────────

  it('Step 1: Mentor validates and sanitizes the knowledge pack', () => {
    knowledgePack = buildKnowledgePack()

    // Validation
    expect(validateKnowledgePack(knowledgePack)).toBe(true)

    // Sanitization (no secrets in fixture, so content should be preserved)
    const sanitized = sanitizeKnowledgePack(knowledgePack)
    expect(sanitized.title).toBe(knowledgePack.title)
    expect(sanitized.skills[0].content).toBe(knowledgePack.skills[0].content)

    // ID is a SHA-256 hex
    expect(knowledgePack.id).toMatch(/^[a-f0-9]{64}$/)
  })

  // ─── Step 2: Mentor lists pack on marketplace ──────────────────────────────

  it('Step 2: Mentor POSTs pack to marketplace', async () => {
    knowledgePack = buildKnowledgePack()

    const req = makeReq('POST', '/api/marketplace/packs', {
      mentorName: knowledgePack.mentor.name,
      mentorSecret: MENTOR_SECRET,
      title: knowledgePack.title,
      description: knowledgePack.description,
      category: knowledgePack.category,
      skills: knowledgePack.skills.map((s) => s.name),
      pricing: knowledgePack.pricing,
      metrics: { avgApy: '28%', tvl: '$50k' },
    })

    const res = await packsPOST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.title).toBe(knowledgePack.title)
    expect(body.data.mentorSecret).toBeUndefined()

    packId = body.data.id
    expect(typeof packId).toBe('string')
    expect(packId.length).toBeGreaterThan(0)
  })

  // ─── Step 3: Mentee browses packs ─────────────────────────────────────────

  it('Step 3: Mentee GETs pack listing', async () => {
    knowledgePack = buildKnowledgePack()
    // Seed a pack
    const pack: PackListing = {
      id: knowledgePack.id,
      mentorName: 'Major',
      mentorSecret: hashSecretImpl(MENTOR_SECRET),
      title: knowledgePack.title,
      description: knowledgePack.description,
      category: knowledgePack.category,
      skills: knowledgePack.skills.map((s) => s.name),
      pricing: { type: 'one-time', amount: 150, currency: 'USDT' },
      metrics: { avgApy: '28%' },
      rating: 0, reviewCount: 0, totalSessions: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    inMemoryPacks.set(pack.id, pack)
    packId = pack.id

    const req = makeReq('GET', '/api/marketplace/packs')
    const res = await packsGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.length).toBeGreaterThanOrEqual(1)
    const found = body.data.find((p: PackListing) => p.id === packId)
    expect(found).toBeDefined()
    expect(found.title).toBe(knowledgePack.title)
    expect(found.mentorSecret).toBeUndefined()
  })

  // ─── Step 4: Mentee views pack details ────────────────────────────────────

  it('Step 4: Mentee GETs pack details by id', async () => {
    knowledgePack = buildKnowledgePack()
    const pack: PackListing = {
      id: knowledgePack.id,
      mentorName: 'Major',
      mentorSecret: hashSecretImpl(MENTOR_SECRET),
      title: knowledgePack.title,
      description: knowledgePack.description,
      category: knowledgePack.category,
      skills: knowledgePack.skills.map((s) => s.name),
      pricing: { type: 'one-time', amount: 150, currency: 'USDT' },
      metrics: {}, rating: 0, reviewCount: 0, totalSessions: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    inMemoryPacks.set(pack.id, pack)
    packId = pack.id

    const req = makeReq('GET', `/api/marketplace/packs/${packId}`)
    const res = await packByIdGET(req, params(packId))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe(packId)
    expect(body.data.description).toBe(knowledgePack.description)
    expect(body.data.reviews).toEqual([]) // no reviews yet
  })

  // ─── Step 5: Mentee starts a session ──────────────────────────────────────

  it('Step 5: Mentee POSTs session request', async () => {
    knowledgePack = buildKnowledgePack()
    const pack: PackListing = {
      id: knowledgePack.id,
      mentorName: 'Major',
      mentorSecret: hashSecretImpl(MENTOR_SECRET),
      title: knowledgePack.title,
      description: knowledgePack.description,
      category: knowledgePack.category,
      skills: ['Liquidity Pool Basics'],
      pricing: { type: 'one-time', amount: 150, currency: 'USDT' },
      metrics: {}, rating: 0, reviewCount: 0, totalSessions: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    inMemoryPacks.set(pack.id, pack)
    packId = pack.id

    const req = makeReq('POST', '/api/marketplace/sessions', { packId })
    const res = await sessionsPOST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.packId).toBe(packId)
    expect(body.data.status).toBe('waiting')
    expect(typeof body.data.roomCode).toBe('string')
    expect(body.data.roomCode.length).toBeGreaterThan(0)

    sessionId = body.data.id
    roomCode = body.data.roomCode

    // Pack totalSessions should be incremented
    const updatedPack = inMemoryPacks.get(packId)!
    expect(updatedPack.totalSessions).toBe(1)
  })

  // ─── Step 6: MentorAgent delivers pack via WebSocket (mocked) ─────────────

  it('Step 6: MentorAgent delivers knowledge pack (mocked WebSocket)', async () => {
    vi.useFakeTimers()

    knowledgePack = buildKnowledgePack()
    const mentor = new MentorAgent('ws://relay.test')
    const sendMessageSpy = vi.spyOn(mentor, 'sendMessage').mockResolvedValue(undefined)
    const sendSpy = vi.spyOn(mentor, 'send').mockResolvedValue(undefined)

    const ROOM = 'E2EROOM001AA'

    // Start session
    const startP = mentor.startMentorSession(ROOM, knowledgePack)
    await vi.runAllTimersAsync()
    await startP

    // Deliver full pack
    const deliverP = mentor.deliverFullPack(ROOM)
    await vi.runAllTimersAsync()
    await deliverP

    vi.useRealTimers()

    // Should have sent many messages
    expect(sendMessageSpy.mock.calls.length).toBeGreaterThan(0)

    // Final message via send() should be pack_complete
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const finalMsg = sendSpy.mock.calls[0][1] as Record<string, unknown>
    const meta = finalMsg.metadata as Record<string, unknown>
    expect(meta.type).toBe('pack_complete')
    expect(meta.pack).toBeDefined()
  })

  // ─── Step 7: MenteeAgent saves pack to memory ─────────────────────────────

  it('Step 7: MenteeAgent saves received pack to memory files', async () => {
    knowledgePack = buildKnowledgePack()
    const mentee = new MenteeAgent('ws://relay.test')
    vi.spyOn(mentee, 'sendMessage').mockResolvedValue(undefined)

    await mentee.saveToMemory(knowledgePack, tmpDir)

    // Session log
    const files = fs.readdirSync(tmpDir)
    const sessionLog = files.find((f) => f.startsWith('mentor-major-'))
    expect(sessionLog).toBeDefined()
    const logContent = fs.readFileSync(path.join(tmpDir, sessionLog!), 'utf-8')
    expect(logContent).toContain(knowledgePack.title)

    // Skills
    for (const skill of knowledgePack.skills) {
      const skillCatDir = path.join(tmpDir, 'skills', skill.category)
      expect(fs.existsSync(skillCatDir)).toBe(true)
      const skillFiles = fs.readdirSync(skillCatDir)
      expect(skillFiles.length).toBeGreaterThan(0)
    }

    // Error log
    const errorLog = files.find((f) => f.startsWith('error-log-'))
    expect(errorLog).toBeDefined()

    // Workflows
    const workflowDir = path.join(tmpDir, 'workflows')
    expect(fs.existsSync(workflowDir)).toBe(true)
    const workflowFiles = fs.readdirSync(workflowDir)
    expect(workflowFiles.length).toBe(knowledgePack.workflows.length)
  })

  // ─── Step 8: Mentee submits a review ──────────────────────────────────────

  it('Step 8: Mentee submits review after completed session', async () => {
    knowledgePack = buildKnowledgePack()
    packId = knowledgePack.id
    sessionId = 'e2e-session-001'

    // Seed pack and completed session
    const pack: PackListing = {
      id: packId,
      mentorName: 'Major',
      mentorSecret: hashSecretImpl(MENTOR_SECRET),
      title: knowledgePack.title,
      description: knowledgePack.description,
      category: knowledgePack.category,
      skills: [],
      pricing: { type: 'one-time', amount: 150, currency: 'USDT' },
      metrics: {}, rating: 0, reviewCount: 0, totalSessions: 1,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    const session: MentorSession = {
      id: sessionId,
      packId,
      roomCode: 'E2EROOM001AA',
      mentorJoined: true,
      menteeJoined: true,
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    inMemoryPacks.set(packId, pack)
    inMemorySessions.set(sessionId, session)

    const req = makeReq('POST', `/api/marketplace/sessions/${sessionId}/review`, {
      rating: 5,
      comment: 'Absolutely transformed my DeFi strategy!',
      menteeName: 'Alice',
    })
    const res = await reviewPOST(req, params(sessionId))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.rating).toBe(5)
    expect(body.data.comment).toBe('Absolutely transformed my DeFi strategy!')
  })

  // ─── Step 9: Verify stats updated ─────────────────────────────────────────

  it('Step 9: Stats reflect the full flow (pack + session + review)', async () => {
    knowledgePack = buildKnowledgePack()
    packId = knowledgePack.id
    sessionId = 'e2e-session-002'

    // Seed state
    const pack: PackListing = {
      id: packId,
      mentorName: 'Major',
      mentorSecret: hashSecretImpl(MENTOR_SECRET),
      title: knowledgePack.title,
      description: knowledgePack.description,
      category: 'defi',
      skills: [],
      pricing: { type: 'one-time', amount: 150, currency: 'USDT' },
      metrics: {}, rating: 4.5, reviewCount: 1, totalSessions: 1,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    const session: MentorSession = {
      id: sessionId,
      packId,
      roomCode: 'E2EROOM002BB',
      mentorJoined: true,
      menteeJoined: true,
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    inMemoryPacks.set(packId, pack)
    inMemorySessions.set(sessionId, session)

    const req = makeReq('GET', '/api/marketplace/stats')
    const res = await statsGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.totalPacks).toBe(1)
    expect(body.data.totalSessions).toBe(1)
    expect(body.data.completedSessions).toBe(1)
    expect(body.data.activeSessions).toBe(0)
    expect(body.data.topCategories[0].name).toBe('defi')
  })

  // ─── Step 10: Pack rating reflects review ─────────────────────────────────

  it('Step 10: Pack rating is updated after review submission', async () => {
    knowledgePack = buildKnowledgePack()
    packId = knowledgePack.id
    sessionId = 'e2e-session-003'

    // Pack starts with rating 0
    const pack: PackListing = {
      id: packId,
      mentorName: 'Major',
      mentorSecret: hashSecretImpl(MENTOR_SECRET),
      title: knowledgePack.title,
      description: knowledgePack.description,
      category: 'defi',
      skills: [],
      pricing: { type: 'one-time', amount: 150, currency: 'USDT' },
      metrics: {}, rating: 0, reviewCount: 0, totalSessions: 1,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    const session: MentorSession = {
      id: sessionId, packId,
      roomCode: 'E2EROOM003CC',
      mentorJoined: true, menteeJoined: true,
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    inMemoryPacks.set(packId, pack)
    inMemorySessions.set(sessionId, session)

    // Submit a 4-star review
    const reviewReq = makeReq('POST', `/api/marketplace/sessions/${sessionId}/review`, {
      rating: 4,
      comment: 'Very solid content, minor gaps in advanced topics.',
      menteeName: 'Bob',
    })
    const reviewRes = await reviewPOST(reviewReq, params(sessionId))
    expect(reviewRes.status).toBe(201)

    // Verify pack was updated with new rating
    const updatedPack = inMemoryPacks.get(packId)!
    expect(updatedPack.rating).toBe(4)
    expect(updatedPack.reviewCount).toBe(1)

    // GET pack details to confirm the rating is visible
    const detailReq = makeReq('GET', `/api/marketplace/packs/${packId}`)
    const detailRes = await packByIdGET(detailReq, params(packId))
    const detailBody = await detailRes.json()

    expect(detailBody.success).toBe(true)
    expect(detailBody.data.rating).toBe(4)
    expect(detailBody.data.reviews).toHaveLength(1)
    expect(detailBody.data.reviews[0].menteeName).toBe('Bob')
  })

  // ─── Full sequential flow ──────────────────────────────────────────────────

  it('Full sequential flow completes without errors', async () => {
    vi.useFakeTimers()
    knowledgePack = buildKnowledgePack()

    // 1. Validate
    expect(validateKnowledgePack(knowledgePack)).toBe(true)

    // 2. Create pack listing
    const createReq = makeReq('POST', '/api/marketplace/packs', {
      mentorName: knowledgePack.mentor.name,
      mentorSecret: MENTOR_SECRET,
      title: knowledgePack.title,
      description: knowledgePack.description,
      category: knowledgePack.category,
      skills: knowledgePack.skills.map((s) => s.name),
      pricing: knowledgePack.pricing,
    })
    const createRes = await packsPOST(createReq)
    expect(createRes.status).toBe(201)
    const { data: createdPack } = await createRes.json()
    packId = createdPack.id

    // 3. Browse packs
    const browseRes = await packsGET(makeReq('GET', '/api/marketplace/packs'))
    expect((await browseRes.json()).data.length).toBeGreaterThanOrEqual(1)

    // 4. View pack details
    const detailRes = await packByIdGET(makeReq('GET', `/api/marketplace/packs/${packId}`), params(packId))
    expect(detailRes.status).toBe(200)

    // 5. Start session
    const sessionRes = await sessionsPOST(makeReq('POST', '/api/marketplace/sessions', { packId }))
    expect(sessionRes.status).toBe(201)
    const { data: session } = await sessionRes.json()
    sessionId = session.id

    // 6. Mentor delivers pack (mocked)
    const mentor = new MentorAgent('ws://relay.test')
    vi.spyOn(mentor, 'sendMessage').mockResolvedValue(undefined)
    vi.spyOn(mentor, 'send').mockResolvedValue(undefined)

    const startP = mentor.startMentorSession(session.roomCode, knowledgePack)
    await vi.runAllTimersAsync()
    await startP

    const deliverP = mentor.deliverFullPack(session.roomCode)
    await vi.runAllTimersAsync()
    await deliverP

    vi.useRealTimers()

    // 7. Mentee saves to memory
    const mentee = new MenteeAgent('ws://relay.test')
    vi.spyOn(mentee, 'sendMessage').mockResolvedValue(undefined)
    await mentee.saveToMemory(knowledgePack, tmpDir)

    const savedFiles = fs.readdirSync(tmpDir)
    expect(savedFiles.length).toBeGreaterThan(0)

    // 8. Mark session completed
    const completePatch = await sessionByIdPATCH(
      makeReq('PATCH', `/api/marketplace/sessions/${sessionId}`, { status: 'completed' }),
      params(sessionId)
    )
    expect(completePatch.status).toBe(200)

    // 9. Submit review
    const reviewRes = await reviewPOST(
      makeReq('POST', `/api/marketplace/sessions/${sessionId}/review`, {
        rating: 5,
        comment: 'Excellent mentor session!',
        menteeName: 'TestMentee',
      }),
      params(sessionId)
    )
    expect(reviewRes.status).toBe(201)

    // 10. Check stats
    const statsRes = await statsGET(makeReq('GET', '/api/marketplace/stats'))
    const statsBody = await statsRes.json()
    expect(statsBody.data.totalPacks).toBeGreaterThanOrEqual(1)
    expect(statsBody.data.totalSessions).toBeGreaterThanOrEqual(1)

    // 11. Verify pack rating updated
    const finalPack = inMemoryPacks.get(packId)!
    expect(finalPack.rating).toBe(5)
    expect(finalPack.reviewCount).toBe(1)
  })
})
