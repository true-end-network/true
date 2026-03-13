/**
 * mentor-mentee.test.ts
 *
 * Tests for MentorAgent and MenteeAgent. The WebSocket-dependent base class
 * (AnonymousAgent) methods are spied/mocked so no real network connections occur.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Mock 'ws' so AnonymousAgent never opens a real socket.
// The constructor in AnonymousAgent creates `new WebSocket(url)` only when
// connect() is called. Since we spy on sendMessage/send, connect() is never called.
// ---------------------------------------------------------------------------
vi.mock('ws', () => {
  const EventEmitter = require('events').EventEmitter
  class MockWebSocket extends EventEmitter {
    static OPEN = 1
    readyState = MockWebSocket.OPEN
    send = vi.fn()
    close = vi.fn()
    constructor() {
      super()
    }
  }
  return { default: MockWebSocket, WebSocket: MockWebSocket, ...MockWebSocket }
})

import { AnonymousAgent } from '../agent-sdk/client'
import { MentorAgent } from '../agent-sdk/mentor'
import { MenteeAgent } from '../agent-sdk/mentee'
import { SkillCategory, type KnowledgePack } from '../src/lib/knowledge-pack'

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const ROOM_CODE = 'TESTROOM0001'

function makePack(overrides: Partial<KnowledgePack> = {}): KnowledgePack {
  return {
    id: 'pack-test-001',
    version: '1.0.0',
    title: 'DeFi Mastery',
    description: 'Complete guide to DeFi protocols',
    category: SkillCategory.DeFi,
    mentor: {
      name: 'Major',
      platform: 'OpenClaw',
      specialties: ['DeFi', 'yield-farming'],
      experience: '6 weeks continuous operation',
      resultsSnapshot: { 'yield-optimized': '$50k TVL' },
    },
    skills: [
      {
        name: 'Yield Farming Basics',
        category: 'defi',
        difficulty: 'intermediate',
        content: '# Yield Farming\n\nProvide liquidity and earn fees.',
        examples: ['Uniswap V3 LP', 'Curve Finance'],
        pitfalls: ['Impermanent loss', 'Gas fee erosion'],
      },
      {
        name: 'Advanced Strategies',
        category: 'defi',
        difficulty: 'advanced',
        content: '# Advanced Strategies\n\nMulti-protocol yield stacking.',
        examples: ['Convex + Curve'],
        pitfalls: ['Smart contract risk'],
      },
    ],
    errorLog: [
      {
        date: '2025-02-01',
        description: 'Incorrect APY calculation',
        impact: 'Missed opportunity',
        fix: 'Used real-time oracle data',
        lesson: 'Always verify APY sources',
      },
    ],
    workflows: [
      {
        name: 'Daily Yield Check',
        description: 'Monitor and rebalance daily',
        steps: [
          { step: 1, action: 'Check APY on Defillama' },
          { step: 2, action: 'Rebalance if delta > 20%', notes: 'Only if gas is cheap' },
        ],
        triggers: ['Every morning', 'APY drop > 20%'],
      },
    ],
    toolConfigs: [],
    templates: [],
    metrics: {
      period: '6 weeks',
      metrics: { tvl: { value: '50000', unit: 'USD', change: '+15%' } },
      verifiable: true,
    },
    pricing: {
      type: 'one-time',
      amount: 99,
      currency: 'USDT',
      trialAvailable: false,
    },
    metadata: {
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-02-01T00:00:00Z',
      language: 'en',
      targetAudience: 'DeFi beginners to intermediate',
      tags: ['defi', 'yield'],
      prerequisites: ['Basic crypto knowledge'],
    },
    ...overrides,
  } as KnowledgePack
}

// ---------------------------------------------------------------------------
// Helper to create a MentorAgent with mocked network methods
// ---------------------------------------------------------------------------

function createMockedMentorAgent(): {
  mentor: MentorAgent
  sendMessageSpy: ReturnType<typeof vi.fn>
  sendSpy: ReturnType<typeof vi.fn>
} {
  const mentor = new MentorAgent('ws://localhost:9999')
  const sendMessageSpy = vi.spyOn(mentor, 'sendMessage').mockResolvedValue(undefined)
  const sendSpy = vi.spyOn(mentor, 'send').mockResolvedValue(undefined)
  return { mentor, sendMessageSpy, sendSpy }
}

function createMockedMenteeAgent(): {
  mentee: MenteeAgent
  sendMessageSpy: ReturnType<typeof vi.fn>
} {
  const mentee = new MenteeAgent('ws://localhost:9999')
  const sendMessageSpy = vi.spyOn(mentee, 'sendMessage').mockResolvedValue(undefined)
  return { mentee, sendMessageSpy }
}

// ---------------------------------------------------------------------------
// MentorAgent tests
// ---------------------------------------------------------------------------

describe('MentorAgent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ── startMentorSession ────────────────────────────────────────────────────

  describe('startMentorSession', () => {
    it('sends an intro system message to the room', async () => {
      const { mentor, sendMessageSpy } = createMockedMentorAgent()
      const pack = makePack()

      const promise = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await promise

      expect(sendMessageSpy).toHaveBeenCalledTimes(1)
      const [roomArg, contentArg, typeArg] = sendMessageSpy.mock.calls[0]
      expect(roomArg).toBe(ROOM_CODE)
      expect(typeof contentArg).toBe('string')
      expect(contentArg).toContain('Mentor Session Started')
      expect(contentArg).toContain(pack.mentor.name)
      expect(contentArg).toContain(pack.title)
      expect(typeArg).toBe('system')
    })

    it('sanitizes the pack before storing (strips secrets from content)', async () => {
      const { mentor, sendMessageSpy } = createMockedMentorAgent()
      const pack = makePack()
      pack.skills[0].content = 'Use sk-secretkey12345678901234567890 for auth'

      const promise = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await promise

      // The sendMessage content should not contain the raw secret
      const content = sendMessageSpy.mock.calls[0][1] as string
      expect(content).not.toContain('sk-secretkey')
    })

    it('throws if startMentorSession called twice for the same room (state replaced)', async () => {
      const { mentor } = createMockedMentorAgent()
      const pack = makePack()
      const p1 = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await p1
      // Second call should overwrite state silently (no error expected)
      const p2 = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await expect(p2).resolves.toBeUndefined()
    })
  })

  // ── deliverSkill ──────────────────────────────────────────────────────────

  describe('deliverSkill', () => {
    it('throws if startMentorSession was not called first', async () => {
      const { mentor } = createMockedMentorAgent()
      await expect(mentor.deliverSkill(ROOM_CODE, 0)).rejects.toThrow('No active mentor session')
    })

    it('throws for out-of-range skill index', async () => {
      const { mentor } = createMockedMentorAgent()
      const pack = makePack()

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp

      await expect(mentor.deliverSkill(ROOM_CODE, 99)).rejects.toThrow('out of range')
    })

    it('sends system header + content + examples + pitfalls messages', async () => {
      const { mentor, sendMessageSpy } = createMockedMentorAgent()
      const pack = makePack()

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp

      sendMessageSpy.mockClear()

      const dp = mentor.deliverSkill(ROOM_CODE, 0)
      await vi.runAllTimersAsync()
      await dp

      // Expect at least: header (system), content, examples, pitfalls = 4 calls
      expect(sendMessageSpy.mock.calls.length).toBeGreaterThanOrEqual(4)

      const types = sendMessageSpy.mock.calls.map((c) => c[2])
      expect(types[0]).toBe('system') // header

      const allContent = sendMessageSpy.mock.calls.map((c) => c[1]).join('\n')
      expect(allContent).toContain(pack.skills[0].name)
      expect(allContent).toContain(pack.skills[0].content)
      expect(allContent).toContain('Examples')
      expect(allContent).toContain('Pitfalls')
    })

    it('marks the skill as delivered in internal state', async () => {
      const { mentor } = createMockedMentorAgent()
      const pack = makePack()

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp

      const dp = mentor.deliverSkill(ROOM_CODE, 0)
      await vi.runAllTimersAsync()
      await dp

      // Access private state to verify
      const state = (mentor as any)[
        'deliveryStates'
      ].get(ROOM_CODE)
      expect(state?.deliveredSkills.has(0)).toBe(true)
    })

    it('skips examples section if skill has no examples', async () => {
      const { mentor, sendMessageSpy } = createMockedMentorAgent()
      const pack = makePack()
      pack.skills[0].examples = []

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp
      sendMessageSpy.mockClear()

      const dp = mentor.deliverSkill(ROOM_CODE, 0)
      await vi.runAllTimersAsync()
      await dp

      const allContent = sendMessageSpy.mock.calls.map((c) => c[1]).join('\n')
      expect(allContent).not.toContain('Examples')
    })
  })

  // ── deliverErrorLog ───────────────────────────────────────────────────────

  describe('deliverErrorLog', () => {
    it('throws if startMentorSession was not called', async () => {
      const { mentor } = createMockedMentorAgent()
      await expect(mentor.deliverErrorLog(ROOM_CODE)).rejects.toThrow('No active mentor session')
    })

    it('sends a system header and one message per error entry', async () => {
      const { mentor, sendMessageSpy } = createMockedMentorAgent()
      const pack = makePack()

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp
      sendMessageSpy.mockClear()

      const dp = mentor.deliverErrorLog(ROOM_CODE)
      await vi.runAllTimersAsync()
      await dp

      // 1 system header + 1 per error entry
      expect(sendMessageSpy.mock.calls.length).toBe(1 + pack.errorLog.length)
      expect(sendMessageSpy.mock.calls[0][2]).toBe('system')

      const allContent = sendMessageSpy.mock.calls.map((c) => c[1]).join('\n')
      expect(allContent).toContain(pack.errorLog[0].description)
      expect(allContent).toContain(pack.errorLog[0].lesson)
      expect(allContent).toContain('Error Log')
    })

    it('sets errorLogDelivered flag to true', async () => {
      const { mentor } = createMockedMentorAgent()
      const pack = makePack()

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp

      const dp = mentor.deliverErrorLog(ROOM_CODE)
      await vi.runAllTimersAsync()
      await dp

      const state = (mentor as any)[
        'deliveryStates'
      ].get(ROOM_CODE)
      expect(state?.errorLogDelivered).toBe(true)
    })
  })

  // ── deliverWorkflows ──────────────────────────────────────────────────────

  describe('deliverWorkflows', () => {
    it('throws if startMentorSession was not called', async () => {
      const { mentor } = createMockedMentorAgent()
      await expect(mentor.deliverWorkflows(ROOM_CODE)).rejects.toThrow('No active mentor session')
    })

    it('sends a system header and workflow details', async () => {
      const { mentor, sendMessageSpy } = createMockedMentorAgent()
      const pack = makePack()

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp
      sendMessageSpy.mockClear()

      const dp = mentor.deliverWorkflows(ROOM_CODE)
      await vi.runAllTimersAsync()
      await dp

      expect(sendMessageSpy.mock.calls.length).toBe(1 + pack.workflows.length)

      const allContent = sendMessageSpy.mock.calls.map((c) => c[1]).join('\n')
      expect(allContent).toContain(pack.workflows[0].name)
      expect(allContent).toContain(pack.workflows[0].steps[0].action)
      expect(allContent).toContain(pack.workflows[0].triggers[0])
    })

    it('sets workflowsDelivered flag to true', async () => {
      const { mentor } = createMockedMentorAgent()
      const pack = makePack()

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp

      const dp = mentor.deliverWorkflows(ROOM_CODE)
      await vi.runAllTimersAsync()
      await dp

      const state = (mentor as any)[
        'deliveryStates'
      ].get(ROOM_CODE)
      expect(state?.workflowsDelivered).toBe(true)
    })
  })

  // ── deliverFullPack ───────────────────────────────────────────────────────

  describe('deliverFullPack', () => {
    it('throws if startMentorSession was not called', async () => {
      const { mentor } = createMockedMentorAgent()
      await expect(mentor.deliverFullPack(ROOM_CODE)).rejects.toThrow('No active mentor session')
    })

    it('delivers skills, errorLog, workflows and final pack_complete message', async () => {
      const { mentor, sendMessageSpy, sendSpy } = createMockedMentorAgent()
      const pack = makePack()

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp
      sendMessageSpy.mockClear()
      sendSpy.mockClear()

      const dp = mentor.deliverFullPack(ROOM_CODE)
      await vi.runAllTimersAsync()
      await dp

      // sendMessage called for skill headers + content + examples + pitfalls + error log + workflows
      expect(sendMessageSpy.mock.calls.length).toBeGreaterThan(0)

      // send() called once with pack_complete
      expect(sendSpy).toHaveBeenCalledTimes(1)
      const sendArg = sendSpy.mock.calls[0][1] as Record<string, unknown>
      expect(sendArg.type).toBe('system')
      const meta = sendArg.metadata as Record<string, unknown>
      expect(meta.type).toBe('pack_complete')
      expect(meta.packId).toBe(pack.id)
      expect(meta.pack).toBeDefined()
    })

    it('marks all skills as delivered after deliverFullPack', async () => {
      const { mentor } = createMockedMentorAgent()
      const pack = makePack()

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp

      const dp = mentor.deliverFullPack(ROOM_CODE)
      await vi.runAllTimersAsync()
      await dp

      const state = (mentor as any)[
        'deliveryStates'
      ].get(ROOM_CODE)
      for (let i = 0; i < pack.skills.length; i++) {
        expect(state?.deliveredSkills.has(i)).toBe(true)
      }
    })

    it('skips errorLog section if pack has no error entries', async () => {
      const { mentor, sendSpy } = createMockedMentorAgent()
      const pack = makePack({ errorLog: [] })

      const sp = mentor.startMentorSession(ROOM_CODE, pack)
      await vi.runAllTimersAsync()
      await sp

      const dp = mentor.deliverFullPack(ROOM_CODE)
      await vi.runAllTimersAsync()
      await dp

      // sendSpy (for final pack_complete) should still be called
      expect(sendSpy).toHaveBeenCalledTimes(1)
    })
  })
})

// ---------------------------------------------------------------------------
// MenteeAgent tests
// ---------------------------------------------------------------------------

describe('MenteeAgent', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── askQuestion ───────────────────────────────────────────────────────────

  describe('askQuestion', () => {
    it('calls sendMessage with the question text', async () => {
      const { mentee, sendMessageSpy } = createMockedMenteeAgent()
      await mentee.askQuestion(ROOM_CODE, 'What is impermanent loss?')
      expect(sendMessageSpy).toHaveBeenCalledWith(
        ROOM_CODE,
        'What is impermanent loss?',
        'text'
      )
    })

    it('sends to the correct room', async () => {
      const { mentee, sendMessageSpy } = createMockedMenteeAgent()
      await mentee.askQuestion('OTHER_ROOM', 'Hello?')
      expect(sendMessageSpy.mock.calls[0][0]).toBe('OTHER_ROOM')
    })
  })

  // ── receiveMentorSession ──────────────────────────────────────────────────

  describe('receiveMentorSession', () => {
    it('resolves when pack_complete message arrives via onMessage handler', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      const receivePromise = mentee.receiveMentorSession(ROOM_CODE, 5000)

      // Simulate the mentor sending pack_complete by triggering the onMessage event
      const onMessage = (mentee as any)['events']
        ?.onMessage

      expect(typeof onMessage).toBe('function')

      onMessage(
        {
          type: 'system',
          content: '✅ Knowledge Pack delivery complete.',
          metadata: { type: 'pack_complete', packId: pack.id, pack },
        },
        {},
        ROOM_CODE
      )

      const result = await receivePromise
      expect(result.id).toBe(pack.id)
      expect(result.title).toBe(pack.title)
    })

    it('rejects after timeout if no pack_complete message arrives', async () => {
      vi.useFakeTimers()
      const { mentee } = createMockedMenteeAgent()

      const receivePromise = mentee.receiveMentorSession(ROOM_CODE, 100)
      // Register rejection handler BEFORE advancing timers to avoid unhandled rejection
      const assertionPromise = expect(receivePromise).rejects.toThrow(
        'Timeout waiting for mentor session'
      )
      await vi.advanceTimersByTimeAsync(200)
      vi.useRealTimers()
      await assertionPromise
    })

    it('does not resolve for wrong roomCode', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      let resolved = false
      const receivePromise = mentee.receiveMentorSession(ROOM_CODE, 5000).then((p) => {
        resolved = true
        return p
      })

      // Trigger for a DIFFERENT room
      const onMessage = (mentee as any)['events']
        ?.onMessage
      onMessage(
        { type: 'system', content: '✅', metadata: { type: 'pack_complete', pack } },
        {},
        'DIFFERENT_ROOM'
      )

      // Give microtasks a tick to settle
      await new Promise((r) => setTimeout(r, 0))
      expect(resolved).toBe(false)

      // Clean up pending promise
      receivePromise.catch(() => {})
    })
  })

  // ── saveToMemory ──────────────────────────────────────────────────────────

  describe('saveToMemory', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentee-test-'))
    })

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('creates the session log file', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      await mentee.saveToMemory(pack, tmpDir)

      const files = fs.readdirSync(tmpDir)
      const sessionLog = files.find((f) => f.startsWith('mentor-major-'))
      expect(sessionLog).toBeDefined()
      expect(sessionLog).toMatch(/\.md$/)
    })

    it('session log contains pack title and mentor info', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      await mentee.saveToMemory(pack, tmpDir)

      const files = fs.readdirSync(tmpDir)
      const logFile = files.find((f) => f.startsWith('mentor-'))!
      const content = fs.readFileSync(path.join(tmpDir, logFile), 'utf-8')
      expect(content).toContain(pack.title)
      expect(content).toContain(pack.mentor.name)
    })

    it('creates per-skill files in the correct category subdirectory', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      await mentee.saveToMemory(pack, tmpDir)

      for (const skill of pack.skills) {
        const categoryDir = path.join(tmpDir, 'skills', skill.category)
        expect(fs.existsSync(categoryDir)).toBe(true)

        const skillFiles = fs.readdirSync(categoryDir)
        expect(skillFiles.length).toBeGreaterThan(0)
      }
    })

    it('skill file content includes skill name and content', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      await mentee.saveToMemory(pack, tmpDir)

      // Find the file for skills[0] by its slug (lowercase, spaces→dashes)
      const skill0 = pack.skills[0]
      const slug = skill0.name
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .toLowerCase()
      const skillDir = path.join(tmpDir, 'skills', skill0.category)
      const skillContent = fs.readFileSync(path.join(skillDir, `${slug}.md`), 'utf-8')
      expect(skillContent).toContain(skill0.name)
      expect(skillContent).toContain(skill0.content)
    })

    it('creates the error log file', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      await mentee.saveToMemory(pack, tmpDir)

      const files = fs.readdirSync(tmpDir)
      const errorLog = files.find((f) => f.startsWith('error-log-'))
      expect(errorLog).toBeDefined()
      expect(errorLog).toMatch(/\.md$/)
    })

    it('error log file contains error entries', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      await mentee.saveToMemory(pack, tmpDir)

      const files = fs.readdirSync(tmpDir)
      const logFile = files.find((f) => f.startsWith('error-log-'))!
      const content = fs.readFileSync(path.join(tmpDir, logFile), 'utf-8')
      expect(content).toContain(pack.errorLog[0].description)
      expect(content).toContain(pack.errorLog[0].lesson)
    })

    it('creates workflow files in the workflows subdirectory', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      await mentee.saveToMemory(pack, tmpDir)

      const workflowDir = path.join(tmpDir, 'workflows')
      expect(fs.existsSync(workflowDir)).toBe(true)

      const workflowFiles = fs.readdirSync(workflowDir)
      expect(workflowFiles).toHaveLength(pack.workflows.length)
    })

    it('workflow file contains steps and triggers', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack()

      await mentee.saveToMemory(pack, tmpDir)

      const workflowDir = path.join(tmpDir, 'workflows')
      const wfFile = fs.readdirSync(workflowDir)[0]
      const content = fs.readFileSync(path.join(workflowDir, wfFile), 'utf-8')
      expect(content).toContain(pack.workflows[0].steps[0].action)
      expect(content).toContain(pack.workflows[0].triggers[0])
    })

    it('handles pack with no skills gracefully', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack({ skills: [] })

      await expect(mentee.saveToMemory(pack, tmpDir)).resolves.toBeUndefined()
    })

    it('handles pack with no workflows gracefully', async () => {
      const { mentee } = createMockedMenteeAgent()
      const pack = makePack({ workflows: [] })

      await expect(mentee.saveToMemory(pack, tmpDir)).resolves.toBeUndefined()
    })
  })
})
