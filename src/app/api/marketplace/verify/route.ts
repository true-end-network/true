import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/marketplace-store"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const VALID_PLATFORMS = new Set(["x", "instagram", "tiktok", "youtube"])

function getIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}

/** Fetch follower count and engagement metrics from X (Twitter) API v2. */
async function verifyX(handle: string): Promise<{
  success: boolean
  metrics?: { followers?: number }
  error?: string
}> {
  const bearerToken = process.env.X_BEARER_TOKEN ?? process.env.TWITTER_BEARER_TOKEN
  if (!bearerToken) {
    return { success: false, error: "X API not configured — screenshot required" }
  }

  try {
    const url =
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}` +
      `?user.fields=public_metrics`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      return { success: false, error: `X API error: ${res.status}` }
    }

    const json = (await res.json()) as {
      data?: { public_metrics?: { followers_count?: number } }
      errors?: { detail: string }[]
    }

    if (json.errors?.length || !json.data?.public_metrics) {
      return { success: false, error: json.errors?.[0]?.detail ?? "User not found" }
    }

    return {
      success: true,
      metrics: { followers: json.data.public_metrics.followers_count },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(request: NextRequest) {
  const ip = getIp(request)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429, headers: CORS }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400, headers: CORS }
    )
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be an object" },
      { status: 400, headers: CORS }
    )
  }

  const { platform, handle } = body as Record<string, unknown>

  if (!platform || typeof platform !== "string" || !VALID_PLATFORMS.has(platform)) {
    return NextResponse.json(
      { success: false, error: "platform must be x | instagram | tiktok | youtube" },
      { status: 400, headers: CORS }
    )
  }
  if (!handle || typeof handle !== "string" || handle.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "handle is required" },
      { status: 400, headers: CORS }
    )
  }

  const cleanHandle = handle.trim().replace(/^@/, "")

  if (platform === "x") {
    const { success, metrics, error: apiError } = await verifyX(cleanHandle)
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          method: "self_reported",
          platform,
          handle: cleanHandle,
          message: apiError ?? "Verification failed",
          action: "Upload a screenshot to prove your metrics",
        },
        { status: 200, headers: CORS }
      )
    }
    return NextResponse.json(
      { success: true, verified: true, method: "api_verified", platform, handle: cleanHandle, metrics },
      { headers: CORS }
    )
  }

  // instagram | tiktok | youtube — self-reported only
  return NextResponse.json(
    {
      success: true,
      verified: false,
      method: "self_reported",
      platform,
      handle: cleanHandle,
      message: `${platform} API verification is not available. Upload a screenshot instead.`,
      action: "screenshot_required",
    },
    { status: 200, headers: CORS }
  )
}
