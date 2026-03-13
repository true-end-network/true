import { NextRequest, NextResponse } from "next/server"
import store, { hashSecret, checkRateLimit, type PackListing } from "@/lib/marketplace-store"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function getIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}

function stripSecret(pack: PackListing): Omit<PackListing, "mentorSecret"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { mentorSecret: _s, ...safe } = pack
  return safe
}

type Props = { params: Promise<{ id: string }> }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ---------------------------------------------------------------------------
// GET /api/marketplace/packs/:id
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: Props) {
  const ip = getIp(request)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429, headers: CORS }
    )
  }

  const { id } = await params
  const pack = await store.getPack(id)
  if (!pack) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: CORS }
    )
  }

  const reviews = await store.getPackReviews(id)
  const safe = stripSecret(pack)

  return NextResponse.json(
    { success: true, data: { ...safe, reviews } },
    { headers: CORS }
  )
}

// ---------------------------------------------------------------------------
// PATCH /api/marketplace/packs/:id
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: Props) {
  const ip = getIp(request)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429, headers: CORS }
    )
  }

  const { id } = await params

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

  const raw = body as Record<string, unknown>
  const { mentorSecret } = raw

  if (!mentorSecret || typeof mentorSecret !== "string") {
    return NextResponse.json(
      { success: false, error: "mentorSecret is required" },
      { status: 403, headers: CORS }
    )
  }

  const pack = await store.getPack(id)
  if (!pack) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: CORS }
    )
  }

  if (hashSecret(mentorSecret) !== pack.mentorSecret) {
    return NextResponse.json(
      { success: false, error: "Invalid mentorSecret" },
      { status: 403, headers: CORS }
    )
  }

  // Build updates — exclude mentorSecret
  const allowed = ["title", "description", "category", "skills", "pricing", "metrics", "rating"] as const
  const updates: Partial<PackListing> = {}
  for (const key of allowed) {
    if (key in raw) {
      (updates as Record<string, unknown>)[key] = raw[key]
    }
  }

  const updated = await store.updatePack(id, updates)
  if (!updated) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: CORS }
    )
  }

  return NextResponse.json(
    { success: true, data: stripSecret(updated) },
    { headers: CORS }
  )
}

// ---------------------------------------------------------------------------
// DELETE /api/marketplace/packs/:id
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: Props) {
  const ip = getIp(request)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429, headers: CORS }
    )
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const raw =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}

  const { mentorSecret } = raw

  if (!mentorSecret || typeof mentorSecret !== "string") {
    return NextResponse.json(
      { success: false, error: "mentorSecret is required" },
      { status: 403, headers: CORS }
    )
  }

  const pack = await store.getPack(id)
  if (!pack) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: CORS }
    )
  }

  if (hashSecret(mentorSecret) !== pack.mentorSecret) {
    return NextResponse.json(
      { success: false, error: "Invalid mentorSecret" },
      { status: 403, headers: CORS }
    )
  }

  await store.deletePack(id)

  return NextResponse.json(
    { success: true, data: { id: pack.id } },
    { headers: CORS }
  )
}
