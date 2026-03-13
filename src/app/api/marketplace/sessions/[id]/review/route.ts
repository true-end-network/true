import { NextRequest, NextResponse } from 'next/server'
import store, { checkRateLimit } from '@/lib/marketplace-store'
import type { Review } from '@/lib/marketplace-store'

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') ?? '127.0.0.1'
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getIp(req)
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const session = await store.getSession(id)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
  }

  if (session.status !== 'completed') {
    return NextResponse.json(
      { success: false, error: 'Session must be completed before submitting a review' },
      { status: 400 }
    )
  }

  const { rating, comment, menteeName } = body

  if (!comment || !menteeName) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: rating, comment, menteeName' },
      { status: 400 }
    )
  }

  const ratingNum = Number(rating)
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json(
      { success: false, error: 'Rating must be between 1 and 5' },
      { status: 400 }
    )
  }

  const review: Review = {
    sessionId: id,
    rating: ratingNum,
    comment: comment as string,
    menteeName: menteeName as string,
    createdAt: new Date().toISOString(),
  }

  await store.addReview(session.packId, review)

  // Recalculate pack rating
  const allReviews = await store.getPackReviews(session.packId)
  const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
  await store.updatePack(session.packId, {
    rating: Math.round(avgRating * 10) / 10,
    reviewCount: allReviews.length,
  })

  return NextResponse.json({ success: true, data: review }, { status: 201 })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getIp(req)
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const { id } = await params

  const session = await store.getSession(id)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
  }

  const allReviews = await store.getPackReviews(session.packId)
  const sessionReviews = allReviews.filter(r => r.sessionId === id)

  return NextResponse.json({ success: true, data: sessionReviews }, { status: 200 })
}
