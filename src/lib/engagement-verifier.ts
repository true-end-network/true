import { createHash } from "crypto"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformMetrics {
  followers?: number
  following?: number
  posts?: number
  engagement_rate?: number
  avg_likes?: number
  avg_views?: number
  impressions_30d?: number
}

export type VerificationConfidence = "high" | "medium" | "low"
export type VerificationMethod = "api" | "screenshot_hash" | "self_reported"

export interface VerificationResult {
  verified: boolean
  platform: string
  handle: string
  metrics: PlatformMetrics
  confidence: VerificationConfidence
  method: VerificationMethod
  verifiedAt: string
  /** SHA-256 hash of the screenshot buffer, if screenshot was provided */
  screenshotHash?: string
  /** Human-readable note about verification outcome */
  note?: string
}

export interface Badge {
  id: string
  label: string
  description: string
  emoji: string
  earnedAt: string
}

// ---------------------------------------------------------------------------
// Twitter / X Verification
// ---------------------------------------------------------------------------

/**
 * Verify Twitter/X engagement metrics for a given handle.
 *
 * When a valid Twitter API v2 Bearer Token is available via the
 * TWITTER_BEARER_TOKEN environment variable the function performs a real API
 * call and returns high-confidence, API-verified results.
 *
 * Without the token it falls back to self-reported status so the rest of the
 * pipeline can continue without crashing.
 */
export async function verifyTwitterEngagement(
  handle: string
): Promise<VerificationResult> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  const cleanHandle = handle.replace(/^@/, "")
  const now = new Date().toISOString()

  if (!bearerToken) {
    return {
      verified: false,
      platform: "twitter",
      handle: cleanHandle,
      metrics: {},
      confidence: "low",
      method: "self_reported",
      verifiedAt: now,
      note: "No TWITTER_BEARER_TOKEN configured — cannot perform API verification.",
    }
  }

  try {
    // Twitter API v2 — user lookup with public_metrics
    const userUrl =
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(cleanHandle)}` +
      `?user.fields=public_metrics,created_at`

    const userResp = await fetch(userUrl, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    })

    if (!userResp.ok) {
      const errText = await userResp.text()
      return {
        verified: false,
        platform: "twitter",
        handle: cleanHandle,
        metrics: {},
        confidence: "low",
        method: "api",
        verifiedAt: now,
        note: `Twitter API error ${userResp.status}: ${errText}`,
      }
    }

    const userData = (await userResp.json()) as {
      data?: {
        id: string
        public_metrics: {
          followers_count: number
          following_count: number
          tweet_count: number
          like_count: number
        }
      }
      errors?: Array<{ detail: string }>
    }

    if (!userData.data) {
      return {
        verified: false,
        platform: "twitter",
        handle: cleanHandle,
        metrics: {},
        confidence: "low",
        method: "api",
        verifiedAt: now,
        note: userData.errors?.[0]?.detail ?? "User not found.",
      }
    }

    const pub = userData.data.public_metrics
    const metrics: PlatformMetrics = {
      followers: pub.followers_count,
      following: pub.following_count,
      posts: pub.tweet_count,
    }

    // Attempt to get recent tweet metrics for engagement rate estimation.
    // The v2 API requires read:tweets scope but let's try — failure is handled.
    try {
      const userId = userData.data.id
      const tweetsUrl =
        `https://api.twitter.com/2/users/${userId}/tweets` +
        `?max_results=10&tweet.fields=public_metrics`

      const tweetsResp = await fetch(tweetsUrl, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      })

      if (tweetsResp.ok) {
        const tweetsData = (await tweetsResp.json()) as {
          data?: Array<{
            public_metrics: {
              like_count: number
              impression_count: number
            }
          }>
        }

        if (tweetsData.data && tweetsData.data.length > 0) {
          const totalLikes = tweetsData.data.reduce(
            (sum, t) => sum + t.public_metrics.like_count,
            0
          )
          const totalImpressions = tweetsData.data.reduce(
            (sum, t) => sum + t.public_metrics.impression_count,
            0
          )
          metrics.avg_likes = Math.round(totalLikes / tweetsData.data.length)
          metrics.impressions_30d = totalImpressions
          if (totalImpressions > 0) {
            metrics.engagement_rate =
              Math.round((totalLikes / totalImpressions) * 10000) / 100
          }
        }
      }
    } catch {
      // Best-effort — continue without tweet-level metrics
    }

    return {
      verified: true,
      platform: "twitter",
      handle: cleanHandle,
      metrics,
      confidence: "high",
      method: "api",
      verifiedAt: now,
      note: "Verified via Twitter API v2 public_metrics.",
    }
  } catch (err) {
    return {
      verified: false,
      platform: "twitter",
      handle: cleanHandle,
      metrics: {},
      confidence: "low",
      method: "api",
      verifiedAt: now,
      note: `Network error during Twitter API call: ${String(err)}`,
    }
  }
}

// ---------------------------------------------------------------------------
// Screenshot-Based Verification
// ---------------------------------------------------------------------------

/**
 * Process a screenshot of analytics data (Instagram insights, TikTok analytics,
 * YouTube Studio, etc.) and return a medium-confidence verification result.
 *
 * The image buffer is hashed with SHA-256 so the original screenshot can be
 * linked to this verification record without storing the full image in the DB.
 *
 * Actual metric extraction from the image requires an external OCR/vision
 * service — pass the claimedMetrics from the user alongside the screenshot
 * and this function stores the hash for manual or AI review.
 */
export async function processScreenshotProof(
  platform: string,
  imageBuffer: Buffer,
  claimedMetrics: PlatformMetrics,
  handle: string = "unknown"
): Promise<VerificationResult> {
  const now = new Date().toISOString()

  if (!imageBuffer || imageBuffer.length === 0) {
    return {
      verified: false,
      platform,
      handle,
      metrics: claimedMetrics,
      confidence: "low",
      method: "self_reported",
      verifiedAt: now,
      note: "Empty image buffer — screenshot proof not accepted.",
    }
  }

  // Hash the screenshot for storage and audit trail
  const screenshotHash = createHash("sha256").update(imageBuffer).digest("hex")

  // Sanity-check the claimed metrics
  const issues = validateMetrics(claimedMetrics)

  if (issues.length > 0) {
    return {
      verified: false,
      platform,
      handle,
      metrics: claimedMetrics,
      confidence: "low",
      method: "screenshot_hash",
      verifiedAt: now,
      screenshotHash,
      note: `Metric validation failed: ${issues.join("; ")}`,
    }
  }

  return {
    verified: true,
    platform,
    handle,
    metrics: claimedMetrics,
    confidence: "medium",
    method: "screenshot_hash",
    verifiedAt: now,
    screenshotHash,
    note: `Screenshot received and hashed. Claimed metrics stored pending human/AI review. Hash: ${screenshotHash.slice(0, 16)}…`,
  }
}

// ---------------------------------------------------------------------------
// Trust Score
// ---------------------------------------------------------------------------

/**
 * Compute a 0–100 trust score from an array of VerificationResults.
 *
 * Scoring model:
 *  - API verified result:          +40 pts per platform (max 2 → 80)
 *  - Screenshot-reviewed result:   +20 pts per platform (max 2 → 40)
 *  - Self-reported result:         + 5 pts per platform (max 2 → 10)
 *
 * Penalties:
 *  - Any unverified result:        -10 pts each
 *  - Confidence "low":             - 5 pts each
 *
 * Score is clamped to [0, 100].
 */
export function calculateTrustScore(proofs: VerificationResult[]): number {
  if (!proofs || proofs.length === 0) return 0

  let score = 0

  // Count contribution per platform (cap at 2 platforms for scoring)
  const seenPlatforms = new Map<string, VerificationResult>()

  for (const proof of proofs) {
    const key = proof.platform.toLowerCase()
    // Prefer higher-confidence result per platform
    const existing = seenPlatforms.get(key)
    if (
      !existing ||
      confidenceRank(proof.confidence) > confidenceRank(existing.confidence)
    ) {
      seenPlatforms.set(key, proof)
    }
  }

  const platformEntries = [...seenPlatforms.values()].slice(0, 2)

  for (const proof of platformEntries) {
    if (proof.verified) {
      switch (proof.method) {
        case "api":
          score += 40
          break
        case "screenshot_hash":
          score += 20
          break
        case "self_reported":
          score += 5
          break
      }
    } else {
      score -= 10
    }

    if (proof.confidence === "low") {
      score -= 5
    }
  }

  // Bonus: multiple independently verified platforms signals broader legitimacy
  const verifiedCount = platformEntries.filter((p) => p.verified).length
  if (verifiedCount >= 2) score += 10

  // Clamp
  return Math.max(0, Math.min(100, score))
}

// ---------------------------------------------------------------------------
// Badge System
// ---------------------------------------------------------------------------

/**
 * Derive a set of earned badges from an array of VerificationResults.
 *
 * Badge catalogue:
 *   verified_mentor  — at least 1 API-verified platform
 *   top_rated        — avg_likes or impressions_30d above the "top rated" threshold
 *                      (proxy used here since we don't have ratings data in-scope)
 *   trending         — provided by caller via `isTrending` flag (most sessions this week)
 *   trusted          — all verified proofs are API-verified, none disputed
 *   data_driven      — at least 2 proofs supplied with quantitative metrics
 */
export function getBadges(
  proofs: VerificationResult[],
  options: {
    avgRating?: number
    ratingCount?: number
    isTrending?: boolean
    hasDisputes?: boolean
  } = {}
): Badge[] {
  const earned: Badge[] = []
  const now = new Date().toISOString()

  // 🏅 Verified Mentor
  const hasApiVerification = proofs.some(
    (p) => p.verified && p.method === "api"
  )
  if (hasApiVerification) {
    earned.push({
      id: "verified_mentor",
      label: "Verified Mentor",
      description: "At least one social platform verified via official API",
      emoji: "🏅",
      earnedAt: now,
    })
  }

  // ⭐ Top Rated
  const { avgRating, ratingCount } = options
  if (avgRating !== undefined && ratingCount !== undefined) {
    if (avgRating >= 4.5 && ratingCount >= 10) {
      earned.push({
        id: "top_rated",
        label: "Top Rated",
        description: "Average rating ≥ 4.5 with 10+ reviews",
        emoji: "⭐",
        earnedAt: now,
      })
    }
  }

  // 🔥 Trending
  if (options.isTrending === true) {
    earned.push({
      id: "trending",
      label: "Trending",
      description: "Most sessions booked this week",
      emoji: "🔥",
      earnedAt: now,
    })
  }

  // 🛡️ Trusted
  const verifiedProofs = proofs.filter((p) => p.verified)
  const allApiVerified =
    verifiedProofs.length > 0 &&
    verifiedProofs.every((p) => p.method === "api")
  const noDisputes = options.hasDisputes !== true
  if (allApiVerified && noDisputes) {
    earned.push({
      id: "trusted",
      label: "Trusted",
      description: "All platforms API-verified, no disputes on record",
      emoji: "🛡️",
      earnedAt: now,
    })
  }

  // 📊 Data-Driven
  const proofsWithMetrics = proofs.filter((p) => hasQuantitativeMetrics(p.metrics))
  if (proofsWithMetrics.length >= 2) {
    earned.push({
      id: "data_driven",
      label: "Data-Driven",
      description: "Provides quantitative metrics proofs across 2+ platforms",
      emoji: "📊",
      earnedAt: now,
    })
  }

  return earned
}

// ---------------------------------------------------------------------------
// Self-Reported Convenience Builder
// ---------------------------------------------------------------------------

/**
 * Build a self-reported VerificationResult without any proof.
 * Lowest trust tier — useful as a starting point before real verification.
 */
export function buildSelfReportedVerification(
  platform: string,
  handle: string,
  metrics: PlatformMetrics
): VerificationResult {
  return {
    verified: false,
    platform,
    handle,
    metrics,
    confidence: "low",
    method: "self_reported",
    verifiedAt: new Date().toISOString(),
    note: "Self-reported — no proof provided. Upgrade to screenshot or API verification.",
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function confidenceRank(c: VerificationConfidence): number {
  switch (c) {
    case "high":
      return 3
    case "medium":
      return 2
    case "low":
      return 1
  }
}

function validateMetrics(m: PlatformMetrics): string[] {
  const issues: string[] = []

  if (m.followers !== undefined && (m.followers < 0 || !Number.isFinite(m.followers))) {
    issues.push("followers must be a non-negative finite number")
  }
  if (m.engagement_rate !== undefined && (m.engagement_rate < 0 || m.engagement_rate > 100)) {
    issues.push("engagement_rate must be between 0 and 100")
  }
  if (m.avg_likes !== undefined && m.avg_likes < 0) {
    issues.push("avg_likes must be non-negative")
  }
  if (m.avg_views !== undefined && m.avg_views < 0) {
    issues.push("avg_views must be non-negative")
  }
  if (m.impressions_30d !== undefined && m.impressions_30d < 0) {
    issues.push("impressions_30d must be non-negative")
  }

  return issues
}

function hasQuantitativeMetrics(m: PlatformMetrics): boolean {
  return (
    m.followers !== undefined ||
    m.avg_likes !== undefined ||
    m.avg_views !== undefined ||
    m.impressions_30d !== undefined ||
    m.engagement_rate !== undefined
  )
}
