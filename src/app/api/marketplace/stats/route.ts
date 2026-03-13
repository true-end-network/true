import { NextRequest, NextResponse } from 'next/server'
import store, { checkRateLimit } from '@/lib/marketplace-store'

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') ?? '127.0.0.1'
}

export async function GET(req: NextRequest) {
  const ip = getIp(req)
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const stats = await store.getStats()

  return NextResponse.json({ success: true, data: stats }, { status: 200 })
}
