import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import store, { checkRateLimit, type MentorSession } from "@/lib/marketplace-store"
import { generateRoomCode } from "@/lib/crypto"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function getIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}

const VALID_STATUSES = new Set(["waiting", "active", "completed", "expired", "cancelled"])

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ---------------------------------------------------------------------------
// GET /api/marketplace/sessions
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const ip = getIp(request)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429, headers: CORS }
    )
  }

  const sp = new URL(request.url).searchParams
  let sessions = await store.getSessions()

  // Filter
  if (sp.has("status")) {
    const status = sp.get("status")!
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status value" },
        { status: 400, headers: CORS }
      )
    }
    sessions = sessions.filter(s => s.status === status)
  }
  if (sp.has("packId")) {
    const packId = sp.get("packId")!
    sessions = sessions.filter(s => s.packId === packId)
  }

  // Sort newest first by startedAt
  sessions = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  return NextResponse.json({ success: true, data: sessions }, { headers: CORS })
}

// ---------------------------------------------------------------------------
// POST /api/marketplace/sessions
// ---------------------------------------------------------------------------

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

  const { packId } = body as Record<string, unknown>

  if (!packId || typeof packId !== "string") {
    return NextResponse.json(
      { error: "packId is required" },
      { status: 400, headers: CORS }
    )
  }

  const pack = await store.getPack(packId)
  if (!pack) {
    return NextResponse.json(
      { success: false, error: "Pack not found" },
      { status: 404, headers: CORS }
    )
  }

  const session: MentorSession = {
    id: randomUUID(),
    packId,
    roomCode: generateRoomCode(),
    mentorJoined: false,
    menteeJoined: false,
    status: "waiting",
    startedAt: new Date().toISOString(),
  }

  await store.addSession(session)
  await store.updatePack(packId, { totalSessions: pack.totalSessions + 1 })

  return NextResponse.json(
    { success: true, data: session },
    { status: 201, headers: CORS }
  )
}
