/**
 * engagement-verifier.ts
 *
 * Verifies mentor engagement proofs and calculates trust scores for knowledge packs.
 * Supports Twitter/X metrics verification, screenshot proofs, and metric validation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProofType = 'twitter' | 'screenshot' | 'metric'

export type BadgeLevel = 'unverified' | 'verified' | 'trusted' | 'elite'

export interface EngagementProof {
  type: ProofType
  source: string        // URL, base64 image, or metric name
  value: string | number
  timestamp: string
  verified: boolean
  expiresAt?: string    // ISO date — if set, proof is invalid after this date
}

export interface VerificationResult {
  trustScore: number    // 0–100
  badge: BadgeLevel
  verifiedProofs: number
  totalProofs: number
  reasoning: string
}

export interface TwitterMetrics {
  followers?: string | number
  following?: string | number
  tweets?: string | number
  engagement_rate?: string | number
  verified_account?: boolean
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseNumeric(value: string | number): number {
  if (typeof value === 'number') return value
  // Handle "14.4K", "1.2M", etc.
  const cleaned = value.replace(/,/g, '').trim().toUpperCase()
  if (cleaned.endsWith('K')) return parseFloat(cleaned) * 1_000
  if (cleaned.endsWith('M')) return parseFloat(cleaned) * 1_000_000
  if (cleaned.endsWith('B')) return parseFloat(cleaned) * 1_000_000_000
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function isExpired(proof: EngagementProof): boolean {
  if (!proof.expiresAt) return false
  return new Date(proof.expiresAt) < new Date()
}

// ---------------------------------------------------------------------------
// Proof verification
// ---------------------------------------------------------------------------

/**
 * Verify Twitter/X engagement metrics. Returns a partial proof with trust contribution.
 */
export function verifyTwitterMetrics(metrics: TwitterMetrics): {
  valid: boolean
  score: number
  reason: string
} {
  if (!metrics || typeof metrics !== 'object') {
    return { valid: false, score: 0, reason: 'Invalid metrics object' }
  }

  let score = 0
  const reasons: string[] = []

  const followers = metrics.followers !== undefined ? parseNumeric(metrics.followers) : -1

  if (followers < 0) {
    return { valid: false, score: 0, reason: 'Missing follower count' }
  }

  if (followers >= 100_000) {
    score += 40
    reasons.push(`${followers.toLocaleString()} followers (100k+)`)
  } else if (followers >= 10_000) {
    score += 25
    reasons.push(`${followers.toLocaleString()} followers (10k+)`)
  } else if (followers >= 1_000) {
    score += 10
    reasons.push(`${followers.toLocaleString()} followers (1k+)`)
  } else {
    reasons.push(`${followers.toLocaleString()} followers (low)`)
  }

  if (metrics.verified_account === true) {
    score += 20
    reasons.push('verified account badge')
  }

  const engRate = metrics.engagement_rate !== undefined
    ? parseNumeric(metrics.engagement_rate)
    : -1

  if (engRate > 0) {
    if (engRate >= 5) {
      score += 20
      reasons.push(`${engRate}% engagement rate (excellent)`)
    } else if (engRate >= 2) {
      score += 10
      reasons.push(`${engRate}% engagement rate (good)`)
    } else {
      reasons.push(`${engRate}% engagement rate (below average)`)
    }
  }

  const valid = score > 0
  return {
    valid,
    score,
    reason: reasons.join(', ') || 'No meaningful metrics',
  }
}

/**
 * Process a screenshot proof. Validates that the source is a non-empty base64 or URL.
 */
export function processScreenshotProof(source: string): {
  valid: boolean
  reason: string
} {
  if (!source || typeof source !== 'string') {
    return { valid: false, reason: 'Empty or invalid source' }
  }

  const trimmed = source.trim()

  // Accept data URLs (base64)
  if (trimmed.startsWith('data:image/')) {
    const base64Part = trimmed.split(',')[1] ?? ''
    if (base64Part.length < 100) {
      return { valid: false, reason: 'Base64 image too small to be valid' }
    }
    return { valid: true, reason: 'Valid base64 image' }
  }

  // Accept https URLs
  if (trimmed.startsWith('https://')) {
    try {
      new URL(trimmed)
      return { valid: true, reason: 'Valid HTTPS URL' }
    } catch {
      return { valid: false, reason: 'Invalid URL format' }
    }
  }

  // Accept http URLs (non-secure, lower trust)
  if (trimmed.startsWith('http://')) {
    return { valid: true, reason: 'Valid HTTP URL (non-secure)' }
  }

  return { valid: false, reason: 'Source must be a data URL or http(s) URL' }
}

// ---------------------------------------------------------------------------
// Trust score calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a 0–100 trust score from a list of engagement proofs.
 * Expired proofs are excluded. Verified proofs contribute more than unverified.
 */
export function calculateTrustScore(proofs: EngagementProof[]): number {
  if (!Array.isArray(proofs) || proofs.length === 0) return 0

  const activeProofs = proofs.filter((p) => !isExpired(p))

  if (activeProofs.length === 0) return 0

  let score = 0

  for (const proof of activeProofs) {
    if (proof.type === 'twitter') {
      score += proof.verified ? 30 : 10
    } else if (proof.type === 'screenshot') {
      score += proof.verified ? 20 : 5
    } else if (proof.type === 'metric') {
      score += proof.verified ? 15 : 5
    }
  }

  // Diversity bonus — reward having multiple proof types
  const types = new Set(activeProofs.map((p) => p.type))
  if (types.size >= 3) score += 10
  else if (types.size >= 2) score += 5

  return Math.min(100, score)
}

// ---------------------------------------------------------------------------
// Badge assignment
// ---------------------------------------------------------------------------

/**
 * Assign a badge level based on trust score.
 * - elite:      score >= 80
 * - trusted:    score >= 55
 * - verified:   score >= 25
 * - unverified: score < 25
 */
export function assignBadge(trustScore: number): BadgeLevel {
  if (trustScore >= 80) return 'elite'
  if (trustScore >= 55) return 'trusted'
  if (trustScore >= 25) return 'verified'
  return 'unverified'
}

// ---------------------------------------------------------------------------
// Full verification pipeline
// ---------------------------------------------------------------------------

/**
 * Run the full verification pipeline on a set of proofs.
 */
export function verifyEngagement(proofs: EngagementProof[]): VerificationResult {
  if (!Array.isArray(proofs) || proofs.length === 0) {
    return {
      trustScore: 0,
      badge: 'unverified',
      verifiedProofs: 0,
      totalProofs: 0,
      reasoning: 'No proofs provided',
    }
  }

  const activeProofs = proofs.filter((p) => !isExpired(p))
  const expiredCount = proofs.length - activeProofs.length

  const trustScore = calculateTrustScore(activeProofs)
  const badge = assignBadge(trustScore)
  const verifiedProofs = activeProofs.filter((p) => p.verified).length

  const parts: string[] = [
    `${activeProofs.length} active proof(s)`,
  ]
  if (expiredCount > 0) parts.push(`${expiredCount} expired`)
  parts.push(`score: ${trustScore}`)
  parts.push(`badge: ${badge}`)

  return {
    trustScore,
    badge,
    verifiedProofs,
    totalProofs: proofs.length,
    reasoning: parts.join(', '),
  }
}
