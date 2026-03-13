import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join, extname } from "path"
import { randomUUID } from "crypto"
import store, { hashSecret, checkRateLimit } from "@/lib/marketplace-store"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-mentor-secret",
}

const DATA_DIR = join(process.cwd(), ".data")
const PROOFS_DIR = join(DATA_DIR, "proofs")

const VALID_PLATFORMS = new Set(["x", "instagram", "tiktok", "youtube"])
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

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

export async function POST(request: NextRequest, { params }: Props) {
  const ip = getIp(request)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429, headers: CORS }
    )
  }

  const mentorSecret = request.headers.get("x-mentor-secret")
  if (!mentorSecret) {
    return NextResponse.json(
      { success: false, error: "x-mentor-secret header is required" },
      { status: 401, headers: CORS }
    )
  }

  const { id: packId } = await params

  const pack = await store.getPack(packId)
  if (!pack) {
    return NextResponse.json(
      { success: false, error: "Pack not found" },
      { status: 404, headers: CORS }
    )
  }

  if (hashSecret(mentorSecret) !== pack.mentorSecret) {
    return NextResponse.json(
      { success: false, error: "Invalid mentorSecret" },
      { status: 401, headers: CORS }
    )
  }

  const contentType = request.headers.get("content-type") ?? ""

  let proofUrl: string | undefined
  let platform: string
  let metrics: Record<string, number> = {}

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid form data" },
        { status: 400, headers: CORS }
      )
    }

    const rawPlatform = formData.get("platform")
    const metricsRaw = formData.get("metrics")
    const imageFile = formData.get("image")

    if (!rawPlatform || typeof rawPlatform !== "string" || !VALID_PLATFORMS.has(rawPlatform)) {
      return NextResponse.json(
        { success: false, error: "platform must be x | instagram | tiktok | youtube" },
        { status: 400, headers: CORS }
      )
    }
    platform = rawPlatform

    if (metricsRaw && typeof metricsRaw === "string") {
      try {
        metrics = JSON.parse(metricsRaw) as Record<string, number>
      } catch {
        return NextResponse.json(
          { success: false, error: "metrics must be valid JSON" },
          { status: 400, headers: CORS }
        )
      }
    }

    if (imageFile instanceof File) {
      if (imageFile.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { success: false, error: "Image too large (max 10 MB)" },
          { status: 400, headers: CORS }
        )
      }
      if (!ALLOWED_MIME.has(imageFile.type)) {
        return NextResponse.json(
          { success: false, error: "Image must be JPEG, PNG, WebP, or GIF" },
          { status: 400, headers: CORS }
        )
      }
      await mkdir(PROOFS_DIR, { recursive: true })
      const ext = extname(imageFile.name) || `.${imageFile.type.split("/")[1]}`
      const filename = `${randomUUID()}${ext}`
      const buffer = Buffer.from(await imageFile.arrayBuffer())
      await writeFile(join(PROOFS_DIR, filename), buffer)
      proofUrl = `/api/marketplace/proofs/${filename}`
    }
  } else {
    // JSON body
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
    const rawPlatform = raw.platform

    if (!rawPlatform || typeof rawPlatform !== "string" || !VALID_PLATFORMS.has(rawPlatform)) {
      return NextResponse.json(
        { success: false, error: "platform must be x | instagram | tiktok | youtube" },
        { status: 400, headers: CORS }
      )
    }
    platform = rawPlatform
    if (raw.metrics && typeof raw.metrics === "object" && !Array.isArray(raw.metrics)) {
      metrics = raw.metrics as Record<string, number>
    }
    if (typeof raw.url === "string") proofUrl = raw.url
  }

  // Append proof to the pack's metrics as a record
  const rawProofs = pack.metrics.__proofs
  const existingProofs: unknown[] = rawProofs ? (JSON.parse(rawProofs) as unknown[]) : []
  const newProof = {
    platform,
    url: proofUrl,
    metrics,
    verifiedAt: new Date().toISOString(),
  }

  await store.updatePack(packId, {
    metrics: {
      ...pack.metrics,
      __proofs: JSON.stringify([...existingProofs, newProof]),
    },
  })

  return NextResponse.json(
    { success: true, data: { proof: newProof } },
    { status: 201, headers: CORS }
  )
}
