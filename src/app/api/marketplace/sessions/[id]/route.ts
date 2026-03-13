import { NextRequest, NextResponse } from "next/server"
import store, { checkRateLimit, type MentorSession } from "@/lib/marketplace-store"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function getIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}

const VALID_STATUSES = new Set<MentorSession["status"]>([
  "waiting",
  "active",
  "completed",
  "expired",
  "cancelled",
])

type Props = { params: Promise<{ id: string }> }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ---------------------------------------------------------------------------
// GET /api/marketplace/sessions/:id
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
  const session = await store.getSession(id)
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: CORS }
    )
  }

  return NextResponse.json({ success: true, data: session }, { headers: CORS })
}

// ---------------------------------------------------------------------------
// PATCH /api/marketplace/sessions/:id
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
  const { status, mentorJoined, menteeJoined } = raw

  if (status !== undefined) {
    if (typeof status !== "string" || !VALID_STATUSES.has(status as MentorSession["status"])) {
      return NextResponse.json(
        { success: false, error: "status must be waiting | active | completed | expired | cancelled" },
        { status: 400, headers: CORS }
      )
    }
  }

  const session = await store.getSession(id)
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: CORS }
    )
  }

  const updates: Partial<MentorSession> = {}
  if (status !== undefined) updates.status = status as MentorSession["status"]
  if (typeof mentorJoined === "boolean") updates.mentorJoined = mentorJoined
  if (typeof menteeJoined === "boolean") updates.menteeJoined = menteeJoined
  if (status === "completed") updates.completedAt = new Date().toISOString()

  const updated = await store.updateSession(id, updates)
  if (!updated) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: CORS }
    )
  }

  return NextResponse.json({ success: true, data: updated }, { headers: CORS })
}
