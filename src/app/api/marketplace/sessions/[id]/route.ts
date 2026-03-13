import { NextRequest, NextResponse } from 'next/server'
import store, { checkRateLimit } from '@/lib/marketplace-store'

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') ?? '127.0.0.1'
}

const VALID_STATUSES = ['waiting', 'active', 'completed'] as const
type ValidStatus = typeof VALID_STATUSES[number]

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

  return NextResponse.json({ success: true, data: session }, { status: 200 })
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

  const session = await store.getSession(id)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { ...body }

  // Validate status if provided
  if ('status' in updates) {
    if (!VALID_STATUSES.includes(updates.status as ValidStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    // When completing, set completedAt
    if (updates.status === 'completed') {
      updates.completedAt = new Date().toISOString()
    }
  }

  const updated = await store.updateSession(id, updates)

  if (!updated) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: updated }, { status: 200 })
}
