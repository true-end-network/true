import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import store, { hashSecret, checkRateLimit, type PackListing } from "@/lib/marketplace-store"

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

function stripSecret(pack: PackListing): Omit<PackListing, "mentorSecret"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { mentorSecret: _s, ...safe } = pack
  return safe
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ---------------------------------------------------------------------------
// GET /api/marketplace/packs
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
  let packs = await store.getPacks()

  // Filter by category
  if (sp.has("category")) {
    const category = sp.get("category")!
    packs = packs.filter(p => p.category === category)
  }

  // Filter by minPrice
  if (sp.has("minPrice")) {
    const minPrice = parseFloat(sp.get("minPrice")!)
    if (!isNaN(minPrice)) {
      packs = packs.filter(p => {
        const amount = (p.pricing as Record<string, number>).amount ?? 0
        return amount >= minPrice
      })
    }
  }

  // Sort
  const sort = sp.get("sort")
  if (sort === "rating") {
    packs = [...packs].sort((a, b) => b.rating - a.rating)
  } else if (sort === "price") {
    packs = [...packs].sort((a, b) => {
      const aAmt = (a.pricing as Record<string, number>).amount ?? 0
      const bAmt = (b.pricing as Record<string, number>).amount ?? 0
      return aAmt - bAmt
    })
  } else {
    // Default: newest first
    packs = [...packs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  return NextResponse.json(
    { success: true, data: packs.map(stripSecret) },
    { headers: CORS }
  )
}

// ---------------------------------------------------------------------------
// POST /api/marketplace/packs
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

  const {
    mentorName,
    mentorSecret,
    title,
    description,
    category,
    skills,
    pricing,
    metrics,
  } = body as Record<string, unknown>

  // Validate required fields
  if (
    !mentorName || typeof mentorName !== "string" ||
    !mentorSecret || typeof mentorSecret !== "string" ||
    !title || typeof title !== "string" ||
    !description || typeof description !== "string" ||
    !category || typeof category !== "string" ||
    !pricing || typeof pricing !== "object" || Array.isArray(pricing)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required fields: mentorName, mentorSecret, title, description, category, pricing",
      },
      { status: 400, headers: CORS }
    )
  }

  // Normalize skills — coerce non-array to []
  const normalizedSkills: string[] = Array.isArray(skills)
    ? (skills as unknown[]).filter((s): s is string => typeof s === "string")
    : []

  const now = new Date().toISOString()
  const pack: PackListing = {
    id: randomUUID(),
    mentorName,
    mentorSecret: hashSecret(mentorSecret),
    title,
    description,
    category,
    skills: normalizedSkills,
    pricing: pricing as Record<string, unknown>,
    metrics:
      metrics && typeof metrics === "object" && !Array.isArray(metrics)
        ? (metrics as Record<string, string>)
        : {},
    rating: 0,
    reviewCount: 0,
    totalSessions: 0,
    createdAt: now,
    updatedAt: now,
  }

  await store.addPack(pack)

  return NextResponse.json(
    { success: true, data: stripSecret(pack) },
    { status: 201, headers: CORS }
  )
}
