import { NextRequest, NextResponse } from "next/server"
import store, { checkRateLimit, type Review } from "@/lib/marketplace-store"

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

type Props = { params: Promise<{ id: string }> }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ---------------------------------------------------------------------------
// GET /api/marketplace/sessions/:id/review
// Returns reviews for this specific session (filtered by sessionId).
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
      { success: false, error: "Session not found" },
      { status: 404, headers: CORS }
    )
  }

  const allReviews = await store.getPackReviews(session.packId)
  const sessionReviews = allReviews.filter(r => r.sessionId === id)

  return NextResponse.json({ success: true, data: sessionReviews }, { headers: CORS })
}

// ---------------------------------------------------------------------------
// POST /api/marketplace/sessions/:id/review
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, { params }: Props) {
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

  const { rating, comment, menteeName } = body as Record<string, unknown>

  if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json(
      { success: false, error: "rating must be an integer between 1 and 5" },
      { status: 400, headers: CORS }
    )
  }
  if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "comment is required" },
      { status: 400, headers: CORS }
    )
  }
  if (!menteeName || typeof menteeName !== "string") {
    return NextResponse.json(
      { success: false, error: "menteeName is required" },
      { status: 400, headers: CORS }
    )
  }

  const session = await store.getSession(id)
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Session not found" },
      { status: 404, headers: CORS }
    )
  }

  if (session.status !== "completed") {
    return NextResponse.json(
      { success: false, error: "Session must be completed before submitting a review" },
      { status: 400, headers: CORS }
    )
  }

  const review: Review = {
    sessionId: id,
    rating,
    comment: comment.trim(),
    menteeName,
    createdAt: new Date().toISOString(),
  }

  await store.addReview(session.packId, review)

  // Recalculate pack rating from all reviews (addReview is called first, so result is included)
  const allReviews = await store.getPackReviews(session.packId)
  const avgRating =
    allReviews.length > 0
      ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10
      : 0

  await store.updatePack(session.packId, {
    rating: avgRating,
    reviewCount: allReviews.length,
  })

  return NextResponse.json({ success: true, data: review }, { status: 201, headers: CORS })
}
