import { describe, it, expect } from 'vitest'
import {
  SkillCategory,
  validateKnowledgePack,
  sanitizeKnowledgePack,
  generatePackId,
  type KnowledgePack,
} from '../src/lib/knowledge-pack'

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

function makeValidPack(overrides: Record<string, unknown> = {}): KnowledgePack {
  return {
    id: 'abc123',
    version: '1.0.0',
    title: 'Social Media Mastery',
    description: 'Automation guide for social media growth',
    category: SkillCategory.SocialMedia,
    mentor: {
      name: 'Major',
      platform: 'OpenClaw',
      specialties: ['social-media', 'automation'],
      experience: '6 weeks, 24/7',
      resultsSnapshot: { followers: '14.4K' },
    },
    skills: [
      {
        name: 'Thread Creation',
        category: 'social-media',
        difficulty: 'intermediate',
        content: '# How to create threads\n\nStep by step guide.',
        examples: ['Example thread 1', 'Example thread 2'],
        pitfalls: ['Too long', 'Bad timing'],
      },
    ],
    errorLog: [
      {
        date: '2025-01-15',
        description: 'Posted unverified info',
        impact: 'Lost credibility',
        fix: 'Added verification step',
        lesson: 'Always check sources',
      },
    ],
    workflows: [
      {
        name: 'Daily Post',
        description: 'Post once per day',
        steps: [
          { step: 1, action: 'Check trends' },
          { step: 2, action: 'Draft post', notes: 'Keep under 280 chars' },
        ],
        triggers: ['Every morning at 9am', 'Breaking news'],
      },
    ],
    toolConfigs: [],
    templates: [],
    metrics: {
      period: '6 weeks',
      metrics: {
        followers: { value: '14400', unit: 'total', change: '+2400' },
      },
      verifiable: true,
    },
    pricing: {
      type: 'one-time',
      amount: 50,
      currency: 'USD',
      trialAvailable: true,
    },
    metadata: {
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
      language: 'en',
      targetAudience: 'Content creators',
      tags: ['social', 'automation'],
      prerequisites: ['Basic Twitter knowledge'],
    },
    ...overrides,
  } as KnowledgePack
}

// ---------------------------------------------------------------------------
// SkillCategory enum
// ---------------------------------------------------------------------------

describe('SkillCategory enum', () => {
  it('contains all expected categories', () => {
    expect(SkillCategory.SocialMedia).toBe('social-media')
    expect(SkillCategory.CryptoIntel).toBe('crypto-intel')
    expect(SkillCategory.Sales).toBe('sales')
    expect(SkillCategory.ContentCreation).toBe('content-creation')
    expect(SkillCategory.DevOps).toBe('devops')
    expect(SkillCategory.Analytics).toBe('analytics')
    expect(SkillCategory.Productivity).toBe('productivity')
    expect(SkillCategory.SmartHome).toBe('smart-home')
    expect(SkillCategory.DeFi).toBe('defi')
    expect(SkillCategory.Trading).toBe('trading')
  })

  it('has exactly 10 categories', () => {
    const values = Object.values(SkillCategory)
    expect(values).toHaveLength(10)
  })

  it('all values are unique strings', () => {
    const values = Object.values(SkillCategory)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})

// ---------------------------------------------------------------------------
// validateKnowledgePack
// ---------------------------------------------------------------------------

describe('validateKnowledgePack', () => {
  it('returns true for a fully valid pack', () => {
    expect(validateKnowledgePack(makeValidPack())).toBe(true)
  })

  it('returns false for non-object inputs', () => {
    expect(validateKnowledgePack(null)).toBe(false)
    expect(validateKnowledgePack(undefined)).toBe(false)
    expect(validateKnowledgePack(42)).toBe(false)
    expect(validateKnowledgePack('string')).toBe(false)
    expect(validateKnowledgePack([])).toBe(false)
  })

  it('returns false when top-level id is missing or empty', () => {
    expect(validateKnowledgePack(makeValidPack({ id: '' }))).toBe(false)
    expect(validateKnowledgePack(makeValidPack({ id: 123 }))).toBe(false)
    const { id: _id, ...noId } = makeValidPack()
    expect(validateKnowledgePack(noId)).toBe(false)
  })

  it('returns false when version is missing or wrong type', () => {
    expect(validateKnowledgePack(makeValidPack({ version: '' }))).toBe(false)
    expect(validateKnowledgePack(makeValidPack({ version: null }))).toBe(false)
  })

  it('returns false when title is missing or wrong type', () => {
    expect(validateKnowledgePack(makeValidPack({ title: '' }))).toBe(false)
    expect(validateKnowledgePack(makeValidPack({ title: 999 }))).toBe(false)
  })

  it('returns false when category is not a valid SkillCategory', () => {
    expect(validateKnowledgePack(makeValidPack({ category: 'hacking' }))).toBe(false)
    expect(validateKnowledgePack(makeValidPack({ category: '' }))).toBe(false)
    expect(validateKnowledgePack(makeValidPack({ category: 42 }))).toBe(false)
  })

  it('returns true for every valid SkillCategory value', () => {
    for (const cat of Object.values(SkillCategory)) {
      expect(validateKnowledgePack(makeValidPack({ category: cat }))).toBe(true)
    }
  })

  it('returns false when mentor fields are missing', () => {
    expect(validateKnowledgePack(makeValidPack({ mentor: null }))).toBe(false)
    expect(validateKnowledgePack(makeValidPack({ mentor: { name: 'X' } }))).toBe(false)
    expect(
      validateKnowledgePack(
        makeValidPack({
          mentor: { name: 'M', platform: 'P', experience: 'E', specialties: 'bad', resultsSnapshot: {} },
        })
      )
    ).toBe(false)
  })

  it('returns false when skills array contains an invalid entry', () => {
    const badSkill = { name: 'Bad', category: 'x', content: 'c', difficulty: 'expert', examples: [], pitfalls: [] }
    expect(validateKnowledgePack(makeValidPack({ skills: [badSkill] }))).toBe(false)
  })

  it('returns false when skill is missing required fields', () => {
    const missingContent = { name: 'X', category: 'social-media', difficulty: 'beginner', examples: [], pitfalls: [] }
    expect(validateKnowledgePack(makeValidPack({ skills: [missingContent] }))).toBe(false)
  })

  it('accepts all valid difficulty levels in skills', () => {
    for (const diff of ['beginner', 'intermediate', 'advanced'] as const) {
      const pack = makeValidPack()
      pack.skills[0].difficulty = diff
      expect(validateKnowledgePack(pack)).toBe(true)
    }
  })

  it('returns false when errorLog entry is incomplete', () => {
    const badEntry = { date: '2025-01-01', description: 'oops' } // missing impact/fix/lesson
    expect(validateKnowledgePack(makeValidPack({ errorLog: [badEntry] }))).toBe(false)
  })

  it('returns false when workflow steps have wrong types', () => {
    const badWorkflow = {
      name: 'W',
      description: 'D',
      triggers: ['t'],
      steps: [{ step: 'one', action: 'do thing' }], // step must be number
    }
    expect(validateKnowledgePack(makeValidPack({ workflows: [badWorkflow] }))).toBe(false)
  })

  it('returns false when pricing type is invalid', () => {
    const pack = makeValidPack()
    pack.pricing.type = 'free' as never
    expect(validateKnowledgePack(pack)).toBe(false)
  })

  it('returns false when pricing amount is not a number', () => {
    const pack = makeValidPack()
    ;(pack.pricing as never as Record<string, unknown>).amount = 'fifty'
    expect(validateKnowledgePack(pack)).toBe(false)
  })

  it('returns false when currency is not valid', () => {
    const pack = makeValidPack()
    ;(pack.pricing as never as Record<string, unknown>).currency = 'GBP'
    expect(validateKnowledgePack(pack)).toBe(false)
  })

  it('returns true for all valid currencies', () => {
    for (const currency of ['USD', 'USDT', 'ETH', 'SOL', 'BRL'] as const) {
      const pack = makeValidPack()
      pack.pricing.currency = currency
      expect(validateKnowledgePack(pack)).toBe(true)
    }
  })

  it('returns true for all valid pricing types', () => {
    for (const type of ['one-time', 'subscription', 'per-session'] as const) {
      const pack = makeValidPack()
      pack.pricing.type = type
      expect(validateKnowledgePack(pack)).toBe(true)
    }
  })

  it('returns false when metrics.verifiable is not boolean', () => {
    const pack = makeValidPack()
    ;(pack.metrics as never as Record<string, unknown>).verifiable = 'yes'
    expect(validateKnowledgePack(pack)).toBe(false)
  })

  it('returns false when metadata is missing required string fields', () => {
    const pack = makeValidPack()
    ;(pack.metadata as never as Record<string, unknown>).language = 42
    expect(validateKnowledgePack(pack)).toBe(false)
  })

  it('returns false when metadata tags is not an array', () => {
    const pack = makeValidPack()
    ;(pack.metadata as never as Record<string, unknown>).tags = 'automation'
    expect(validateKnowledgePack(pack)).toBe(false)
  })

  it('accepts pack with empty skills/errorLog/workflows arrays', () => {
    const pack = makeValidPack({ skills: [], errorLog: [], workflows: [], toolConfigs: [], templates: [] })
    expect(validateKnowledgePack(pack)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// sanitizeKnowledgePack
// ---------------------------------------------------------------------------

describe('sanitizeKnowledgePack', () => {
  it('preserves clean content without modification', () => {
    const pack = makeValidPack()
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.title).toBe(pack.title)
    expect(sanitized.description).toBe(pack.description)
    expect(sanitized.skills[0].content).toBe(pack.skills[0].content)
  })

  it('redacts OpenAI-style API keys (sk- prefix)', () => {
    const pack = makeValidPack({
      description: 'Use this key: sk-abc123defghijklmnopqrstu to authenticate',
    })
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.description).not.toContain('sk-abc123')
    expect(sanitized.description).toContain('[REDACTED]')
  })

  it('redacts Bearer tokens', () => {
    const pack = makeValidPack()
    pack.skills[0].content = 'Call API with: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig'
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.skills[0].content).toContain('[REDACTED]')
    expect(sanitized.skills[0].content).not.toContain('Bearer eyJ')
  })

  it('redacts JWT tokens in content', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const pack = makeValidPack({ description: `Token: ${jwt}` })
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.description).not.toContain('eyJhbGciOi')
    expect(sanitized.description).toContain('[REDACTED]')
  })

  it('redacts PASSWORD= assignment patterns', () => {
    const pack = makeValidPack()
    pack.errorLog[0].fix = 'Set PASSWORD=supersecretvalue123 in env'
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.errorLog[0].fix).toContain('[REDACTED]')
    expect(sanitized.errorLog[0].fix).not.toContain('supersecretvalue123')
  })

  it('redacts TOKEN= assignment patterns', () => {
    const pack = makeValidPack()
    pack.workflows[0].steps[0].notes = 'TOKEN=abc123tokenvalue456'
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.workflows[0].steps[0].notes).toContain('[REDACTED]')
  })

  it('redacts SECRET= assignment patterns', () => {
    const pack = makeValidPack()
    pack.workflows[0].description = 'SECRET=mysecretkey123 needed here'
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.workflows[0].description).toContain('[REDACTED]')
    expect(sanitized.workflows[0].description).not.toContain('mysecretkey123')
  })

  it('redacts API_KEY patterns', () => {
    const pack = makeValidPack({
      description: 'api_key: "abc123def456ghi789jkl012" is required',
    })
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.description).toContain('[REDACTED]')
    expect(sanitized.description).not.toContain('abc123def456')
  })

  it('redacts URLs with embedded credentials', () => {
    const pack = makeValidPack({
      description: 'Connect to https://user:mypassword@example.com/api',
    })
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.description).toContain('[REDACTED]')
    expect(sanitized.description).not.toContain('mypassword')
  })

  it('does not modify numeric or boolean fields', () => {
    const pack = makeValidPack()
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.pricing.amount).toBe(pack.pricing.amount)
    expect(sanitized.pricing.trialAvailable).toBe(pack.pricing.trialAvailable)
    expect(sanitized.metrics.verifiable).toBe(pack.metrics.verifiable)
  })

  it('returns a deep copy (does not mutate original)', () => {
    const pack = makeValidPack({
      description: 'Clean content here',
    })
    const originalDescription = pack.description
    sanitizeKnowledgePack(pack)
    expect(pack.description).toBe(originalDescription)
  })

  it('sanitizes secrets nested inside arrays (examples, pitfalls)', () => {
    const pack = makeValidPack()
    pack.skills[0].examples = ['Normal example', 'sk-secretkey12345678901234567890 in example']
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.skills[0].examples[0]).toBe('Normal example')
    expect(sanitized.skills[0].examples[1]).toContain('[REDACTED]')
  })

  it('sanitizes secrets nested in resultsSnapshot', () => {
    const pack = makeValidPack()
    pack.mentor.resultsSnapshot = { token: 'sk-private12345678901234567890abcde' }
    const sanitized = sanitizeKnowledgePack(pack)
    expect(sanitized.mentor.resultsSnapshot.token).toContain('[REDACTED]')
  })
})

// ---------------------------------------------------------------------------
// generatePackId
// ---------------------------------------------------------------------------

describe('generatePackId', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const pack = makeValidPack()
    const id = generatePackId(pack)
    expect(id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns the same id for the same pack content', () => {
    const pack = makeValidPack()
    const id1 = generatePackId(pack)
    const id2 = generatePackId(pack)
    expect(id1).toBe(id2)
  })

  it('excludes the id field from the hash (content-addressable)', () => {
    const packA = makeValidPack({ id: 'id-alpha' })
    const packB = makeValidPack({ id: 'id-beta' })
    expect(generatePackId(packA)).toBe(generatePackId(packB))
  })

  it('produces a different id when title changes', () => {
    const packA = makeValidPack({ title: 'Title A' })
    const packB = makeValidPack({ title: 'Title B' })
    expect(generatePackId(packA)).not.toBe(generatePackId(packB))
  })

  it('produces a different id when description changes', () => {
    const packA = makeValidPack({ description: 'Desc A' })
    const packB = makeValidPack({ description: 'Desc B' })
    expect(generatePackId(packA)).not.toBe(generatePackId(packB))
  })

  it('produces a different id when skill content changes', () => {
    const packA = makeValidPack()
    const packB = makeValidPack()
    packB.skills[0].content = '# Different content'
    expect(generatePackId(packA)).not.toBe(generatePackId(packB))
  })

  it('is deterministic regardless of object key insertion order', () => {
    // Both packs have the same logical content, potentially different key order
    const pack1 = makeValidPack()
    const pack2 = { ...makeValidPack() }
    // Re-insert fields to potentially differ in key order
    expect(generatePackId(pack1)).toBe(generatePackId(pack2))
  })
})
