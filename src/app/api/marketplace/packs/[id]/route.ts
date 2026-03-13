import { NextRequest, NextResponse } from 'next/server'
import store, { hashSecret, checkRateLimit } from '@/lib/marketplace-store'

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') ?? '127.0.0.1'
}

function stripSecret<T extends { mentorSecret?: string }>(pack: T): Omit<T, 'mentorSecret'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { mentorSecret: _secret, ...rest } = pack
  return rest
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getIp(req)
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const { id } = await params
  const pack = await store.getPack(id)

  if (!pack) {
    return NextResponse.json({ success: false, error: 'Pack not found' }, { status: 404 })
  }

  const reviews = await store.getPackReviews(id)
  const safePack = { ...stripSecret(pack), reviews }

  return NextResponse.json({ success: true, data: safePack }, { status: 200 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const pack = await store.getPack(id)
  if (!pack) {
    return NextResponse.json({ success: false, error: 'Pack not found' }, { status: 404 })
  }

  const { mentorSecret, ...updates } = body

  if (!mentorSecret || hashSecret(mentorSecret as string) !== pack.mentorSecret) {
    return NextResponse.json({ success: false, error: 'Forbidden: invalid mentorSecret' }, { status: 403 })
  }

  const updated = await store.updatePack(id, updates as Record<string, unknown>)

  if (!updated) {
    return NextResponse.json({ success: false, error: 'Pack not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: stripSecret(updated) }, { status: 200 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getIp(req)
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const pack = await store.getPack(id)
  if (!pack) {
    return NextResponse.json({ success: false, error: 'Pack not found' }, { status: 404 })
  }

  const { mentorSecret } = body

  if (!mentorSecret || hashSecret(mentorSecret as string) !== pack.mentorSecret) {
    return NextResponse.json({ success: false, error: 'Forbidden: invalid mentorSecret' }, { status: 403 })
  }

  await store.deletePack(id)

  return NextResponse.json({ success: true, data: { id } }, { status: 200 })
}
