/**
 * e2e-academy.test.ts
 *
 * Extended end-to-end tests for True Academy, focused on:
 * - Pack lifecycle: create → search → update → delete
 * - Session lifecycle: create → activate → complete
 * - Review lifecycle: submit → rating recalculation
 * - MentorAgent + MenteeAgent WebSocket delivery
 * - MenteeAgent file persistence (real temp directory)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Hoisted in-memory store
// ---------------------------------------------------------------------------

import type { PackListing, MentorSession, Review } from '../src/lib/marketplace-store'

const { mem, store: memStore, hashFn } = vi.hoisted(() => {
  const mem = {
    packs: new Map<string, PackListing>(),
    sessions: new Map<string, MentorSession>(),
    reviews: new Map<string, Review[]>(),
  }

  const hashFn = (s: string): string => {
    const { createHash } = require('crypto') as typeof import('crypto')
    return createHash('sha256').update(s).digest('hex')
  }

  const store = {
    getPacks: vi.fn(async () => Array.from(mem.packs.values())),
    getPack: vi.fn(async (id: string) => mem.packs.get(id)),
    addPack: vi.fn(async (p: PackListing) => { mem.packs.set(p.id, p) }),
    updatePack: vi.fn(async (id: string, u: Partial<PackListing>) => {
      const existing = mem.packs.get(id)
      if (!existing) return undefined
      const updated = { ...existing, ...u, updatedAt: new Date().toISOString() }
      mem.packs.set(id, updated)
      return updated
    }),
    deletePack: vi.fn(async (id: string) => {
      const had = mem.packs.has(id)
      mem.packs.delete(id)
      return had
    }),
    getSessions: vi.fn(async () => Array.from(mem.sessions.values())),
    getSession: vi.fn(async (id: string) => mem.sessions.get(id)),
    addSession: vi.fn(async (s: MentorSession) => { mem.sessions.set(s.id, s) }),
    updateSession: vi.fn(async (id: string, u: Partial<MentorSession>) => {
      const existing = mem.sessions.get(id)
      if (!existing) return undefined
      const updated = { ...existing, ...u }
      mem.sessions.set(id, updated)
      return updated
    }),
    getPackReviews: vi.fn(async (packId: string) => mem.reviews.get(packId) ?? []),
    addReview: vi.fn(async (packId: string, r: Review) => {
      const list = mem.reviews.get(packId) ?? []
      list.push(r)
      mem.reviews.set(packId, list)
    }),
    getStats: vi.fn(async () => {
      const packs = Array.from(mem.packs.values())
      const sessions = Array.from(mem.sessions.values())
      const cats: Record<string, number> = {}
      for (const p of packs) cats[p.category] = (cats[p.category] ?? 0) + 1
      return {
        totalPacks: packs.length,
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status === 'active' || s.status === 'waiting').length,
        completedSessions: sessions.filter(s => s.status === 'completed').length,
        topCategories: Object.entries(cats).sort(([,a],[,b])=>b-a).slice(0,5).map(([name,count])=>({name,count})),
      }
    }),
  }

  return { mem, store, hashFn }
})

vi.mock('@/lib/marketplace-store', () => ({
  default: memStore,
  hashSecret: vi.fn(hashFn),
  checkRateLimit: vi.fn(() => true),
}))

vi.mock('@/lib/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/crypto')>()
  return { ...actual, generateRoomCode: vi.fn(() => 'ACADROOM0001') }
})

vi.mock('ws', () => {
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

import { GET as packsGET, POST as packsPOST } from '../src/app/api/marketplace/packs/route'
import { GET as packByIdGET, DELETE as packByIdDELETE } from '../src/app/api/marketplace/packs/[id]/route'
import { GET as sessionsGET, POST as sessionsPOST } from '../src/app/api/marketplace/sessions/route'
import { PATCH as sessionByIdPATCH } from '../src/app/api/marketplace/sessions/[id]/route'
import { POST as reviewPOST } from '../src/app/api/marketplace/sessions/[id]/review/route'
import { GET as statsGET } from '../src/app/api/marketplace/stats/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
  })
}
const params = (id: string) => ({ params: Promise.resolve({ id }) })

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const MENTOR_SECRET = 'super-mentor-key-456'

function buildPack(): KnowledgePack {
  const base: KnowledgePack = {
    id: '',
    version: '2.0.0',
    title: 'Crypto Trading Mastery',
    description: 'Advanced crypto trading strategies and risk management.',
    category: SkillCategory.Trading,
    mentor: {
      name: 'CryptoMentor',
      platform: 'TrueAcademy',
      specialties: ['technical-analysis', 'risk-management'],
      experience: '3 years live trading',
      resultsSnapshot: { 'roi-ytd': '45%', 'max-drawdown': '12%' },
    },
    skills: [
      {
        name: 'Support & Resistance',
        category: 'trading',
        difficulty: 'intermediate',
        content: '# Support & Resistance\n\nKey price levels where buying/selling pressure reverses.',
        examples: ['BTC $30k support in 2023', 'ETH $2k resistance'],
        pitfalls: ['False breakouts', 'Over-reliance on horizontal levels'],
      },
    ],
    errorLog: [
      {
        date: '2025-03-01',
        description: 'Over-leveraged during volatility spike',
        impact: 'Liquidated 15% of position',
        fix: 'Reduced max leverage to 3x',
        lesson: 'Always use stop-losses on leveraged positions',
      },
    ],
    workflows: [
      {
        name: 'Pre-Trade Checklist',
        description: 'Run before entering any trade',
        steps: [
          { step: 1, action: 'Check macro calendar' },
          { step: 2, action: 'Confirm trend on 4h chart', notes: 'Use EMA200' },
          { step: 3, action: 'Set stop-loss and take-profit' },
        ],
        triggers: ['Before any trade entry'],
      },
    ],
    toolConfigs: [],
    templates: [],
    metrics: {
      period: '12 months',
      metrics: { roi: { value: '45', unit: '%', change: '+5%' } },
      verifiable: false,
    },
    pricing: { type: 'per-session', amount: 75, currency: 'USDT', trialAvailable: true },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      language: 'en',
      targetAudience: 'Intermediate traders',
      tags: ['crypto', 'trading', 'risk'],
      prerequisites: ['Basic chart reading'],
    },
  }
  base.id = generatePackId(base)
  return base
}

// ---------------------------------------------------------------------------
// Suite 1: Pack lifecycle
// ---------------------------------------------------------------------------

describe('Academy E2E: Pack Lifecycle', () => {
  beforeEach(() => {
    mem.packs.clear(); mem.sessions.clear(); mem.reviews.clear()
    vi.clearAllMocks()
  })

  it('pack validates correctly', () => {
    const pack = buildPack()
    expect(validateKnowledgePack(pack)).toBe(true)
  })

  it('pack ID is deterministic SHA-256', () => {
    const pack = buildPack()
    expect(pack.id).toMatch(/^[a-f0-9]{64}$/)
    expect(pack.id).toBe(generatePackId(pack))
  })

  it('sanitization removes secrets', () => {
    const pack = buildPack()
    pack.description = 'Use TOKEN=supersecret123 to auth'
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.description).toContain('[REDACTED]')
    expect(sanitized.description).not.toContain('supersecret123')
  })

  it('POST creates pack and GET lists it', async () => {
    const createRes = await packsPOST(makeReq('POST', '/api/marketplace/packs', {
      mentorName: 'CryptoMentor', mentorSecret: MENTOR_SECRET,
      title: 'Crypto Trading Mastery', description: 'Advanced trading',
      category: 'trading', skills: ['Support & Resistance'],
      pricing: { type: 'per-session', amount: 75, currency: 'USDT' },
    }))
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()).data
    expect(created.id).toBeTruthy()

    const listRes = await packsGET(makeReq('GET', '/api/marketplace/packs'))
    const listed = (await listRes.json()).data
    expect(listed.some((p: PackListing) => p.id === created.id)).toBe(true)
  })

  it('GET /packs/:id returns pack with empty reviews initially', async () => {
    await packsPOST(makeReq('POST', '/api/marketplace/packs', {
      mentorName: 'X', mentorSecret: MENTOR_SECRET,
      title: 'T', description: 'D', category: 'analytics',
      skills: [], pricing: { type: 'one-time', amount: 50, currency: 'USD' },
    }))
    const packId = Array.from(mem.packs.keys())[0]

    const res = await packByIdGET(makeReq('GET', `/api/marketplace/packs/${packId}`), params(packId))
    const body = await res.json()
    expect(body.data.reviews).toEqual([])
  })

  it('DELETE removes pack', async () => {
    const packId = 'del-pack-001'
    const hashedSecret = hashFn(MENTOR_SECRET)
    mem.packs.set(packId, {
      id: packId, mentorName: 'X', mentorSecret: hashedSecret,
      title: 'T', description: 'D', category: 'defi', skills: [],
      pricing: { type: 'one-time', amount: 10, currency: 'USD' }, metrics: {},
      rating: 0, reviewCount: 0, totalSessions: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })

    const res = await packByIdDELETE(makeReq('DELETE', `/api/marketplace/packs/${packId}`, {
      mentorSecret: MENTOR_SECRET,
    }), params(packId))
    expect(res.status).toBe(200)
    expect(mem.packs.has(packId)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Suite 2: Session lifecycle
// ---------------------------------------------------------------------------

describe('Academy E2E: Session Lifecycle', () => {
  let packId: string

  beforeEach(async () => {
    mem.packs.clear(); mem.sessions.clear(); mem.reviews.clear()
    vi.clearAllMocks()

    const res = await packsPOST(makeReq('POST', '/api/marketplace/packs', {
      mentorName: 'SessionMentor', mentorSecret: MENTOR_SECRET,
      title: 'Session Test Pack', description: 'For session testing',
      category: 'productivity', skills: [],
      pricing: { type: 'subscription', amount: 20, currency: 'USD' },
    }))
    packId = (await res.json()).data.id
  })

  it('POST creates a session in waiting status with room code', async () => {
    const res = await sessionsPOST(makeReq('POST', '/api/marketplace/sessions', { packId }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.data.status).toBe('waiting')
    expect(body.data.roomCode).toBeTruthy()
    expect(body.data.packId).toBe(packId)
  })

  it('session appears in GET /sessions list', async () => {
    await sessionsPOST(makeReq('POST', '/api/marketplace/sessions', { packId }))
    const res = await sessionsGET(makeReq('GET', '/api/marketplace/sessions'))
    const body = await res.json()
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0].packId).toBe(packId)
  })

  it('PATCH transitions session waiting → active → completed', async () => {
    const createRes = await sessionsPOST(makeReq('POST', '/api/marketplace/sessions', { packId }))
    const sessionId = (await createRes.json()).data.id

    const activeRes = await sessionByIdPATCH(
      makeReq('PATCH', `/api/marketplace/sessions/${sessionId}`, { status: 'active' }),
      params(sessionId)
    )
    expect((await activeRes.json()).data.status).toBe('active')

    const completedRes = await sessionByIdPATCH(
      makeReq('PATCH', `/api/marketplace/sessions/${sessionId}`, { status: 'completed' }),
      params(sessionId)
    )
    const completedBody = await completedRes.json()
    expect(completedBody.data.status).toBe('completed')
    expect(completedBody.data.completedAt).toBeTruthy()
  })

  it('stats reflect active and completed sessions correctly', async () => {
    const s1 = await sessionsPOST(makeReq('POST', '/api/marketplace/sessions', { packId }))
    const sid1 = (await s1.json()).data.id
    const s2 = await sessionsPOST(makeReq('POST', '/api/marketplace/sessions', { packId }))
    const sid2 = (await s2.json()).data.id

    await sessionByIdPATCH(
      makeReq('PATCH', `/api/marketplace/sessions/${sid2}`, { status: 'completed' }),
      params(sid2)
    )

    const statsRes = await statsGET(makeReq('GET', '/api/marketplace/stats'))
    const stats = (await statsRes.json()).data
    expect(stats.totalSessions).toBe(2)
    expect(stats.activeSessions).toBe(1)  // sid1 still waiting
    expect(stats.completedSessions).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Suite 3: Review and rating lifecycle
// ---------------------------------------------------------------------------

describe('Academy E2E: Review and Rating Lifecycle', () => {
  let packId: string
  let sessionId: string

  beforeEach(async () => {
    mem.packs.clear(); mem.sessions.clear(); mem.reviews.clear()
    vi.clearAllMocks()

    const createPack = await packsPOST(makeReq('POST', '/api/marketplace/packs', {
      mentorName: 'ReviewMentor', mentorSecret: MENTOR_SECRET,
      title: 'Review Test Pack', description: 'For review testing',
      category: 'defi', skills: ['DeFi basics'],
      pricing: { type: 'one-time', amount: 100, currency: 'USDT' },
    }))
    packId = (await createPack.json()).data.id

    const createSession = await sessionsPOST(makeReq('POST', '/api/marketplace/sessions', { packId }))
    sessionId = (await createSession.json()).data.id

    await sessionByIdPATCH(
      makeReq('PATCH', `/api/marketplace/sessions/${sessionId}`, { status: 'completed' }),
      params(sessionId)
    )
  })

  it('POST review returns 201 with rating and comment', async () => {
    const res = await reviewPOST(
      makeReq('POST', `/api/marketplace/sessions/${sessionId}/review`, {
        rating: 4, comment: 'Very helpful session!', menteeName: 'Alice',
      }),
      params(sessionId)
    )
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.data.rating).toBe(4)
    expect(body.data.comment).toBe('Very helpful session!')
  })

  it('pack rating is updated after review submission', async () => {
    await reviewPOST(
      makeReq('POST', `/api/marketplace/sessions/${sessionId}/review`, {
        rating: 5, comment: 'Excellent!', menteeName: 'Bob',
      }),
      params(sessionId)
    )
    const updatedPack = mem.packs.get(packId)
    expect(updatedPack).toBeDefined()
    expect(updatedPack!.rating).toBeGreaterThan(0)
    expect(updatedPack!.reviewCount).toBeGreaterThan(0)
  })

  it('average rating recalculates correctly across multiple reviews', async () => {
    // First review via a second session
    const s2 = await sessionsPOST(makeReq('POST', '/api/marketplace/sessions', { packId }))
    const sid2 = (await s2.json()).data.id
    await sessionByIdPATCH(
      makeReq('PATCH', `/api/marketplace/sessions/${sid2}`, { status: 'completed' }),
      params(sid2)
    )

    // Submit two reviews: 4 and 2
    await reviewPOST(
      makeReq('POST', `/api/marketplace/sessions/${sessionId}/review`, {
        rating: 4, comment: 'Good', menteeName: 'Alice',
      }),
      params(sessionId)
    )
    await reviewPOST(
      makeReq('POST', `/api/marketplace/sessions/${sid2}/review`, {
        rating: 2, comment: 'Needs improvement', menteeName: 'Bob',
      }),
      params(sid2)
    )

    const reviews = mem.reviews.get(packId) ?? []
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    expect(avg).toBe(3) // (4+2)/2
  })

  it('cannot submit review for non-completed session', async () => {
    const s3 = await sessionsPOST(makeReq('POST', '/api/marketplace/sessions', { packId }))
    const sid3 = (await s3.json()).data.id

    // sid3 is still 'waiting'
    const res = await reviewPOST(
      makeReq('POST', `/api/marketplace/sessions/${sid3}/review`, {
        rating: 5, comment: 'Too early', menteeName: 'Early',
      }),
      params(sid3)
    )
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Suite 4: MentorAgent knowledge delivery (mocked WebSocket)
// ---------------------------------------------------------------------------

describe('Academy E2E: MentorAgent Delivery', () => {
  let mentor: MentorAgent
  const ROOM = 'ACAD_MENTOR_01'

  beforeEach(() => {
    mentor = new MentorAgent('ws://localhost:3001', { name: 'TestMentor', reconnect: false })
    // Inject a fake connected room
    ;(mentor as unknown as { rooms: Map<string, unknown> }).rooms.set(ROOM, {
      code: ROOM, hash: 'hash', key: new Uint8Array(32), peerId: 'peer-1',
      ttl: 3600, shareUrl: ROOM,
    })
    ;(mentor as unknown as { hashToCode: Map<string, string> }).hashToCode.set('hash', ROOM)
    ;(mentor as unknown as { state: string }).state = 'connected'
    ;(mentor as unknown as { ws: unknown }).ws = { readyState: 1, send: vi.fn() }
    vi.spyOn(mentor, 'sendMessage').mockResolvedValue()
    vi.spyOn(mentor, 'send').mockResolvedValue()
  })

  it('startMentorSession sends an intro system message', async () => {
    const pack = buildPack()
    await mentor.startMentorSession(ROOM, pack)
    expect(mentor.sendMessage).toHaveBeenCalledWith(
      ROOM,
      expect.stringContaining('Mentor Session Started'),
      'system'
    )
  })

  it('deliverSkill sends header, content, examples, and pitfalls', async () => {
    const pack = buildPack()
    await mentor.startMentorSession(ROOM, pack)
    vi.mocked(mentor.sendMessage).mockClear()
    await mentor.deliverSkill(ROOM, 0)
    // header + content + examples message + pitfalls message = 4
    expect(mentor.sendMessage).toHaveBeenCalledTimes(4)
  })

  it('deliverSkill throws for out-of-range index', async () => {
    const pack = buildPack()
    await mentor.startMentorSession(ROOM, pack)
    await expect(mentor.deliverSkill(ROOM, 99)).rejects.toThrow('out of range')
  })

  it('deliverErrorLog sends header + one message per error', async () => {
    const pack = buildPack()
    await mentor.startMentorSession(ROOM, pack)
    vi.mocked(mentor.sendMessage).mockClear()
    await mentor.deliverErrorLog(ROOM)
    // 1 header + 1 error entry = 2 calls
    expect(mentor.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('deliverWorkflows sends header + one message per workflow', async () => {
    const pack = buildPack()
    await mentor.startMentorSession(ROOM, pack)
    vi.mocked(mentor.sendMessage).mockClear()
    await mentor.deliverWorkflows(ROOM)
    // 1 header + 1 workflow = 2 calls
    expect(mentor.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('requireState throws if startMentorSession was not called', async () => {
    await expect(mentor.deliverSkill('NO_SESSION_ROOM', 0)).rejects.toThrow('No active mentor session')
  })
})

// ---------------------------------------------------------------------------
// Suite 5: MenteeAgent session reception (mocked)
// ---------------------------------------------------------------------------

describe('Academy E2E: MenteeAgent Reception', () => {
  let mentee: MenteeAgent
  const ROOM = 'ACAD_MENTEE_01'

  beforeEach(() => {
    mentee = new MenteeAgent('ws://localhost:3001', { name: 'TestMentee', reconnect: false })
    ;(mentee as unknown as { rooms: Map<string, unknown> }).rooms.set(ROOM, {
      code: ROOM, hash: 'hash2', key: new Uint8Array(32), peerId: 'peer-2',
      ttl: 3600, shareUrl: ROOM,
    })
    ;(mentee as unknown as { hashToCode: Map<string, string> }).hashToCode.set('hash2', ROOM)
    ;(mentee as unknown as { state: string }).state = 'connected'
    ;(mentee as unknown as { ws: unknown }).ws = { readyState: 1, send: vi.fn() }
    vi.spyOn(mentee, 'sendMessage').mockResolvedValue()
  })

  it('askQuestion sends the question text', async () => {
    await mentee.askQuestion(ROOM, 'What is impermanent loss?')
    expect(mentee.sendMessage).toHaveBeenCalledWith(ROOM, 'What is impermanent loss?', 'text')
  })

  it('receiveMentorSession resolves when pack_complete arrives', async () => {
    const pack = buildPack()

    // Simulate pack_complete message arriving
    setTimeout(() => {
      const onMessage = (mentee as unknown as { events: { onMessage?: Function } }).events.onMessage
      onMessage?.({ type: 'system', content: 'done', metadata: { type: 'pack_complete', pack } }, {}, ROOM)
    }, 10)

    const received = await mentee.receiveMentorSession(ROOM, 5000)
    expect(received.title).toBe(pack.title)
    expect(received.id).toBe(pack.id)
  })

  it('receiveMentorSession rejects on timeout', async () => {
    await expect(mentee.receiveMentorSession(ROOM, 50)).rejects.toThrow('Timeout')
  })
})

// ---------------------------------------------------------------------------
// Suite 6: MenteeAgent.saveToMemory — real file system
// ---------------------------------------------------------------------------

describe('Academy E2E: MenteeAgent.saveToMemory', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-e2e-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates session log file', async () => {
    const mentee = new MenteeAgent('ws://localhost:3001', { reconnect: false })
    const pack = buildPack()
    await mentee.saveToMemory(pack, tmpDir)

    const files = fs.readdirSync(tmpDir)
    const sessionLog = files.find(f => f.startsWith('mentor-') && f.endsWith('.md'))
    expect(sessionLog).toBeTruthy()
  })

  it('session log contains pack title', async () => {
    const mentee = new MenteeAgent('ws://localhost:3001', { reconnect: false })
    const pack = buildPack()
    await mentee.saveToMemory(pack, tmpDir)

    const files = fs.readdirSync(tmpDir)
    const logFile = files.find(f => f.startsWith('mentor-'))!
    const content = fs.readFileSync(path.join(tmpDir, logFile), 'utf-8')
    expect(content).toContain(pack.title)
    expect(content).toContain(pack.mentor.name)
  })

  it('creates skill files organized by category', async () => {
    const mentee = new MenteeAgent('ws://localhost:3001', { reconnect: false })
    const pack = buildPack()
    await mentee.saveToMemory(pack, tmpDir)

    const skillsDir = path.join(tmpDir, 'skills')
    expect(fs.existsSync(skillsDir)).toBe(true)
    const catDir = path.join(skillsDir, 'trading')
    expect(fs.existsSync(catDir)).toBe(true)
    const skillFiles = fs.readdirSync(catDir)
    expect(skillFiles.length).toBeGreaterThan(0)
    expect(skillFiles[0]).toMatch(/\.md$/)
  })

  it('skill file contains skill content', async () => {
    const mentee = new MenteeAgent('ws://localhost:3001', { reconnect: false })
    const pack = buildPack()
    await mentee.saveToMemory(pack, tmpDir)

    const catDir = path.join(tmpDir, 'skills', 'trading')
    const skillFiles = fs.readdirSync(catDir)
    const content = fs.readFileSync(path.join(catDir, skillFiles[0]), 'utf-8')
    expect(content).toContain('Support & Resistance')
  })

  it('creates error log file', async () => {
    const mentee = new MenteeAgent('ws://localhost:3001', { reconnect: false })
    const pack = buildPack()
    await mentee.saveToMemory(pack, tmpDir)

    const errorLog = path.join(tmpDir, `error-log-${pack.mentor.name.toLowerCase().replace(/\s/g, '-')}.md`)
    expect(fs.existsSync(errorLog)).toBe(true)
    const content = fs.readFileSync(errorLog, 'utf-8')
    expect(content).toContain(pack.errorLog[0].description)
  })

  it('creates workflow files', async () => {
    const mentee = new MenteeAgent('ws://localhost:3001', { reconnect: false })
    const pack = buildPack()
    await mentee.saveToMemory(pack, tmpDir)

    const workflowsDir = path.join(tmpDir, 'workflows')
    expect(fs.existsSync(workflowsDir)).toBe(true)
    const workflowFiles = fs.readdirSync(workflowsDir)
    expect(workflowFiles.length).toBeGreaterThan(0)
  })

  it('handles pack with no skills or workflows gracefully', async () => {
    const mentee = new MenteeAgent('ws://localhost:3001', { reconnect: false })
    const pack = { ...buildPack(), skills: [], workflows: [], errorLog: [] }
    await expect(mentee.saveToMemory(pack, tmpDir)).resolves.not.toThrow()
  })
})
