import { NextRequest, NextResponse } from 'next/server'
import store, { checkRateLimit } from '@/lib/marketplace-store'
import type { MentorSession } from '@/lib/marketplace-store'
import { generateRoomCode } from '@/lib/crypto'
import crypto from 'crypto'

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') ?? '127.0.0.1'
}

export async function GET(req: NextRequest) {
  const ip = getIp(req)
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const packId = searchParams.get('packId')

  let sessions = await store.getSessions()

  if (status) {
    sessions = sessions.filter(s => s.status === status)
  }

  if (packId) {
    sessions = sessions.filter(s => s.packId === packId)
  }

  // Sort newest first
  sessions = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  return NextResponse.json({ success: true, data: sessions }, { status: 200 })
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { packId } = body

  if (!packId) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: packId' },
      { status: 400 }
    )
  }

  const pack = await store.getPack(packId as string)
  if (!pack) {
    return NextResponse.json({ success: false, error: 'Pack not found' }, { status: 404 })
  }

  const session: MentorSession = {
    id: crypto.randomUUID(),
    packId: packId as string,
    roomCode: generateRoomCode(),
    mentorJoined: false,
    menteeJoined: false,
    status: 'waiting',
    startedAt: new Date().toISOString(),
  }

  await store.addSession(session)

  // Increment pack's totalSessions
  await store.updatePack(packId as string, { totalSessions: pack.totalSessions + 1 })

  return NextResponse.json({ success: true, data: session }, { status: 201 })
}
