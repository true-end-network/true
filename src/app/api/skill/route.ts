import { readFile } from "fs/promises"
import { join } from "path"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "SKILL.md")
    const content = await readFile(filePath, "utf-8")

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    })
  } catch {
    return new NextResponse("Skill file not found", { status: 404 })
  }
}
