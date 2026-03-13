import { NextRequest, NextResponse } from 'next/server'
import store, { hashSecret, checkRateLimit } from '@/lib/marketplace-store'
import type { PackListing } from '@/lib/marketplace-store'
import crypto from 'crypto'

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') ?? '127.0.0.1'
}

function stripSecret<T extends { mentorSecret?: string }>(pack: T): Omit<T, 'mentorSecret'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { mentorSecret: _secret, ...rest } = pack
  return rest
}

export async function GET(req: NextRequest) {
  const ip = getIp(req)
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const minPrice = searchParams.get('minPrice')
  const sort = searchParams.get('sort')

  let packs = await store.getPacks()

  if (category) {
    packs = packs.filter(p => p.category === category)
  }

  if (minPrice !== null) {
    const min = parseFloat(minPrice)
    if (!isNaN(min)) {
      packs = packs.filter(p => p.pricing.amount >= min)
    }
  }

  if (sort === 'rating') {
    packs = [...packs].sort((a, b) => b.rating - a.rating)
  }

  const safePacks = packs.map(stripSecret)

  return NextResponse.json({ success: true, data: safePacks }, { status: 200 })
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

  const { mentorName, mentorSecret, title, description, category, skills, pricing } = body

  if (!mentorName || !mentorSecret || !title || !description || !category || !pricing) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: mentorName, mentorSecret, title, description, category, skills, pricing' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const pack: PackListing = {
    id: crypto.randomUUID(),
    mentorName: mentorName as string,
    mentorSecret: hashSecret(mentorSecret as string),
    title: title as string,
    description: description as string,
    category: category as string,
    skills: Array.isArray(skills) ? (skills as string[]) : [],
    pricing: pricing as { type: string; amount: number; currency: string },
    metrics: (body.metrics as Record<string, string>) ?? {},
    rating: 0,
    reviewCount: 0,
    totalSessions: 0,
    createdAt: now,
    updatedAt: now,
  }

  await store.addPack(pack)

  return NextResponse.json({ success: true, data: stripSecret(pack) }, { status: 201 })
}
