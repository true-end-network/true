/**
 * engagement-verifier.test.ts
 *
 * Tests for src/lib/engagement-verifier.ts
 * Covers: Twitter verification, screenshot proof processing,
 * trust score calculation, badge assignment, and the full pipeline.
 */

import { describe, it, expect } from 'vitest'
import {
  verifyTwitterMetrics,
  processScreenshotProof,
  calculateTrustScore,
  assignBadge,
  verifyEngagement,
  type EngagementProof,
  type TwitterMetrics,
} from '../src/lib/engagement-verifier'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProof(overrides: Partial<EngagementProof> = {}): EngagementProof {
  return {
    type: 'twitter',
    source: 'https://twitter.com/example',
    value: '14400',
    timestamp: new Date().toISOString(),
    verified: true,
    ...overrides,
  }
}

function futureDate(daysFromNow = 30): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

function pastDate(daysAgo = 10): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// verifyTwitterMetrics
// ---------------------------------------------------------------------------

describe('verifyTwitterMetrics', () => {
  it('returns valid=true with high score for large follower count (100k+)', () => {
    const result = verifyTwitterMetrics({ followers: 150_000 })
    expect(result.valid).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(40)
  })

  it('gives lower score for 10k–100k followers', () => {
    const big = verifyTwitterMetrics({ followers: 150_000 })
    const medium = verifyTwitterMetrics({ followers: 15_000 })
    expect(medium.score).toBeLessThan(big.score)
    expect(medium.valid).toBe(true)
  })

  it('gives score of 0 and valid=false for under 1k followers without other signals', () => {
    const result = verifyTwitterMetrics({ followers: 500 })
    // No high-follower bonus — score stays 0, valid=false
    expect(result.valid).toBe(false)
    expect(result.score).toBe(0)
  })

  it('returns valid=false when followers field is missing', () => {
    const result = verifyTwitterMetrics({} as TwitterMetrics)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('follower')
  })

  it('adds bonus for verified account badge', () => {
    const without = verifyTwitterMetrics({ followers: 1000 })
    const with_ = verifyTwitterMetrics({ followers: 1000, verified_account: true })
    expect(with_.score).toBeGreaterThan(without.score)
  })

  it('adds bonus for high engagement rate (5%+)', () => {
    const low = verifyTwitterMetrics({ followers: 10_000, engagement_rate: 1 })
    const high = verifyTwitterMetrics({ followers: 10_000, engagement_rate: 6 })
    expect(high.score).toBeGreaterThan(low.score)
  })

  it('handles string follower counts like "14.4K"', () => {
    const result = verifyTwitterMetrics({ followers: '14.4K' })
    expect(result.valid).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it('handles "1.2M" follower counts', () => {
    const result = verifyTwitterMetrics({ followers: '1.2M' })
    expect(result.valid).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(40)
  })

  it('returns valid=false for null/undefined input', () => {
    // @ts-expect-error testing runtime guard
    expect(verifyTwitterMetrics(null).valid).toBe(false)
    // @ts-expect-error testing runtime guard
    expect(verifyTwitterMetrics(undefined).valid).toBe(false)
  })

  it('includes reason string describing what was found', () => {
    const result = verifyTwitterMetrics({ followers: 50_000 })
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// processScreenshotProof
// ---------------------------------------------------------------------------

describe('processScreenshotProof', () => {
  it('accepts a valid base64 data URL', () => {
    const fakeBase64 = 'A'.repeat(200)
    const src = `data:image/png;base64,${fakeBase64}`
    const result = processScreenshotProof(src)
    expect(result.valid).toBe(true)
  })

  it('rejects a base64 image that is too small', () => {
    const src = 'data:image/png;base64,abc'
    const result = processScreenshotProof(src)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('small')
  })

  it('accepts a valid https URL', () => {
    const result = processScreenshotProof('https://example.com/screenshot.png')
    expect(result.valid).toBe(true)
  })

  it('accepts a valid http URL', () => {
    const result = processScreenshotProof('http://example.com/image.jpg')
    expect(result.valid).toBe(true)
  })

  it('rejects an empty string', () => {
    const result = processScreenshotProof('')
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('rejects a plain file path (not a URL)', () => {
    const result = processScreenshotProof('/Users/user/screenshot.png')
    expect(result.valid).toBe(false)
  })

  it('rejects a non-URL string', () => {
    const result = processScreenshotProof('just some text')
    expect(result.valid).toBe(false)
  })

  it('always returns a non-empty reason string', () => {
    const result = processScreenshotProof('')
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  // @ts-expect-error testing runtime guard
  it('handles null input gracefully', () => {
    // @ts-expect-error testing runtime guard
    const result = processScreenshotProof(null)
    expect(result.valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// calculateTrustScore
// ---------------------------------------------------------------------------

describe('calculateTrustScore', () => {
  it('returns 0 for an empty proof array', () => {
    expect(calculateTrustScore([])).toBe(0)
  })

  it('returns 0 when all proofs are expired', () => {
    const proofs = [
      makeProof({ type: 'twitter', verified: true, expiresAt: pastDate() }),
      makeProof({ type: 'screenshot', verified: true, expiresAt: pastDate() }),
    ]
    expect(calculateTrustScore(proofs)).toBe(0)
  })

  it('gives higher score for verified proofs vs unverified', () => {
    const verified = calculateTrustScore([makeProof({ type: 'twitter', verified: true })])
    const unverified = calculateTrustScore([makeProof({ type: 'twitter', verified: false })])
    expect(verified).toBeGreaterThan(unverified)
  })

  it('gives twitter proofs more weight than screenshot proofs', () => {
    const twitter = calculateTrustScore([makeProof({ type: 'twitter', verified: true })])
    const screenshot = calculateTrustScore([makeProof({ type: 'screenshot', verified: true })])
    expect(twitter).toBeGreaterThan(screenshot)
  })

  it('adds diversity bonus for 3 different proof types vs single type', () => {
    const diverse = calculateTrustScore([
      makeProof({ type: 'twitter', verified: true }),
      makeProof({ type: 'screenshot', verified: true }),
      makeProof({ type: 'metric', verified: true }),
    ])
    // Single type: only one twitter proof (score=30, no diversity bonus)
    const singleType = calculateTrustScore([
      makeProof({ type: 'twitter', verified: true }),
    ])
    // diverse = 30+20+15+10(bonus) = 75; singleType = 30 → diverse wins
    expect(diverse).toBeGreaterThan(singleType)
  })

  it('adds smaller diversity bonus for 2 different proof types vs single proof', () => {
    // two types: twitter(30) + screenshot(20) + 5 bonus = 55
    const two = calculateTrustScore([
      makeProof({ type: 'twitter', verified: true }),
      makeProof({ type: 'screenshot', verified: true }),
    ])
    // one type, one proof: twitter(30) only = 30
    const one = calculateTrustScore([
      makeProof({ type: 'twitter', verified: true }),
    ])
    expect(two).toBeGreaterThan(one)
  })

  it('caps score at 100', () => {
    const manyProofs = Array.from({ length: 20 }, () =>
      makeProof({ type: 'twitter', verified: true })
    )
    expect(calculateTrustScore(manyProofs)).toBeLessThanOrEqual(100)
  })

  it('ignores expired proofs but counts active ones', () => {
    const proofs = [
      makeProof({ type: 'twitter', verified: true, expiresAt: pastDate() }),
      makeProof({ type: 'metric', verified: true, expiresAt: futureDate() }),
    ]
    const score = calculateTrustScore(proofs)
    // Only the metric proof (non-expired) contributes
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(30) // less than a full twitter proof
  })

  it('returns non-zero for single unverified proof', () => {
    const score = calculateTrustScore([makeProof({ type: 'metric', verified: false })])
    expect(score).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// assignBadge
// ---------------------------------------------------------------------------

describe('assignBadge', () => {
  it('assigns "unverified" for score below 25', () => {
    expect(assignBadge(0)).toBe('unverified')
    expect(assignBadge(10)).toBe('unverified')
    expect(assignBadge(24)).toBe('unverified')
  })

  it('assigns "verified" for score 25–54', () => {
    expect(assignBadge(25)).toBe('verified')
    expect(assignBadge(40)).toBe('verified')
    expect(assignBadge(54)).toBe('verified')
  })

  it('assigns "trusted" for score 55–79', () => {
    expect(assignBadge(55)).toBe('trusted')
    expect(assignBadge(65)).toBe('trusted')
    expect(assignBadge(79)).toBe('trusted')
  })

  it('assigns "elite" for score 80+', () => {
    expect(assignBadge(80)).toBe('elite')
    expect(assignBadge(95)).toBe('elite')
    expect(assignBadge(100)).toBe('elite')
  })

  it('boundary: exactly 25 is "verified" not "unverified"', () => {
    expect(assignBadge(25)).toBe('verified')
  })

  it('boundary: exactly 55 is "trusted" not "verified"', () => {
    expect(assignBadge(55)).toBe('trusted')
  })

  it('boundary: exactly 80 is "elite" not "trusted"', () => {
    expect(assignBadge(80)).toBe('elite')
  })
})

// ---------------------------------------------------------------------------
// verifyEngagement (full pipeline)
// ---------------------------------------------------------------------------

describe('verifyEngagement', () => {
  it('returns unverified result for empty proof array', () => {
    const result = verifyEngagement([])
    expect(result.trustScore).toBe(0)
    expect(result.badge).toBe('unverified')
    expect(result.totalProofs).toBe(0)
    expect(result.verifiedProofs).toBe(0)
    expect(result.reasoning).toContain('No proofs')
  })

  it('returns correct badge for high-quality proofs', () => {
    const proofs = [
      makeProof({ type: 'twitter', verified: true }),
      makeProof({ type: 'screenshot', verified: true }),
      makeProof({ type: 'metric', verified: true }),
    ]
    const result = verifyEngagement(proofs)
    expect(result.trustScore).toBeGreaterThan(0)
    expect(['verified', 'trusted', 'elite']).toContain(result.badge)
  })

  it('counts verified vs total proofs correctly', () => {
    const proofs = [
      makeProof({ type: 'twitter', verified: true }),
      makeProof({ type: 'screenshot', verified: false }),
      makeProof({ type: 'metric', verified: true }),
    ]
    const result = verifyEngagement(proofs)
    expect(result.totalProofs).toBe(3)
    expect(result.verifiedProofs).toBe(2)
  })

  it('excludes expired proofs from total active count', () => {
    const proofs = [
      makeProof({ type: 'twitter', verified: true, expiresAt: pastDate() }),
      makeProof({ type: 'screenshot', verified: true, expiresAt: futureDate() }),
    ]
    const result = verifyEngagement(proofs)
    // totalProofs counts all (including expired)
    expect(result.totalProofs).toBe(2)
    // trust score only from active proof
    expect(result.trustScore).toBeGreaterThan(0)
    expect(result.reasoning).toContain('expired')
  })

  it('all expired proofs → trust score 0 and unverified badge', () => {
    const proofs = [
      makeProof({ type: 'twitter', verified: true, expiresAt: pastDate() }),
      makeProof({ type: 'metric', verified: true, expiresAt: pastDate() }),
    ]
    const result = verifyEngagement(proofs)
    expect(result.trustScore).toBe(0)
    expect(result.badge).toBe('unverified')
  })

  it('reasoning string includes score and badge info', () => {
    const proofs = [makeProof({ type: 'twitter', verified: true })]
    const result = verifyEngagement(proofs)
    expect(result.reasoning).toContain('score')
    expect(result.reasoning).toContain('badge')
  })

  it('handles non-array input gracefully', () => {
    // @ts-expect-error testing runtime guard
    const result = verifyEngagement(null)
    expect(result.trustScore).toBe(0)
    expect(result.badge).toBe('unverified')
  })
})
