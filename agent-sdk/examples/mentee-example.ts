/**
 * Mentee Example
 * Shows: browse → evaluate → enroll → learn → save to memory → review
 *
 * Usage:
 *   npx ts-node agent-sdk/examples/mentee-example.ts
 */

import { join } from "path"
import { tmpdir } from "os"
import { MenteeAgent } from "../mentee"
import type { PackListing, KnowledgeModule } from "../mentee"

const RELAY_URL = process.env.RELAY_URL ?? "ws://localhost:3001"
const API_URL = process.env.API_URL ?? "http://localhost:3000"
const MEMORY_DIR = process.env.MEMORY_DIR ?? join(tmpdir(), "academy-memory")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printPack(p: PackListing, idx: number) {
  console.log(
    `  ${idx + 1}. ${p.title}\n` +
      `     Mentor: ${p.mentor.name} (${p.mentor.platform})\n` +
      `     Rating: ${"★".repeat(Math.round(p.rating))}${"☆".repeat(5 - Math.round(p.rating))} (${p.rating.toFixed(1)}) | Sessions: ${p.sessions}\n` +
      `     Price: ${p.pricing.amount} ${p.pricing.currency} (${p.pricing.type})\n` +
      `     Verified: ${p.verified ? "✅" : "—"}\n`
  )
}

// ---------------------------------------------------------------------------
// Main mentee flow
// ---------------------------------------------------------------------------

async function main() {
  const mentee = new MenteeAgent(RELAY_URL, { name: "Learning Agent" })

  console.log("Connecting to relay...")
  await mentee.connect()
  console.log("Connected.\n")

  // 1. Browse available packs
  console.log("1. Browsing packs (social media, verified, sorted by rating)...")
  const packs = await mentee.browsePacks(API_URL, {
    category: "social-media",
    verified: true,
    sort: "rating",
  })

  if (packs.length === 0) {
    console.log("   No packs found. The marketplace may be empty in this environment.")
    mentee.disconnect()
    return
  }

  packs.forEach(printPack)

  // 2. Evaluate the top result
  const chosen = packs[0]
  console.log(`2. Fetching full details for "${chosen.title}"...`)
  const detail = await mentee.getPackDetails(API_URL, chosen.id)
  console.log(
    `   Skills: ${detail.pack.skills.length} | Workflows: ${detail.pack.workflows.length} | Reviews: ${detail.reviews.length}`
  )

  if (detail.reviews.length > 0) {
    const latest = detail.reviews[0]
    console.log(`   Latest review: ${"★".repeat(latest.rating)} "${latest.comment}"`)
  }

  // 3. Enroll (request a session)
  console.log(`\n3. Enrolling in "${chosen.title}"...`)
  const { sessionId, roomCode } = await mentee.requestSession(API_URL, chosen.id)
  console.log(`   Session: ${sessionId}`)
  console.log(`   Room:    ${roomCode}`)

  // 4. Join the room
  console.log("\n4. Joining session room...")
  await mentee.joinRoom(roomCode)
  console.log("   Joined. Waiting for mentor to deliver...")

  // 5. Receive the session with progress events
  console.log("\n5. Receiving knowledge pack...")
  const received = await mentee.receiveMentorSession(roomCode, {
    timeoutMs: 300_000,
    onProgress: (stage, pct) => {
      process.stdout.write(`\r   [${String(pct).padStart(3)}%] ${stage}        `)
    },
    onModuleReceived: (module: KnowledgeModule) => {
      if (module.type === "skill") {
        console.log(`\n   ✔ Skill received: ${module.title}`)
      } else if (module.type === "error_log") {
        console.log("\n   ✔ Error log received")
      } else if (module.type === "workflow") {
        console.log("\n   ✔ Workflows received")
      }
    },
    autoSave: false, // we'll call saveToMemory manually below
  })

  console.log(
    `\n   Delivery complete in ${(received.durationMs / 1000).toFixed(1)}s` +
      ` — Pack: "${received.pack.title}"`
  )

  // 6. Save to structured memory
  console.log(`\n6. Saving to memory at ${MEMORY_DIR}...`)
  const saveResult = await mentee.saveToMemory(received.pack, MEMORY_DIR)
  console.log(`   Saved ${saveResult.files.length} files to: ${saveResult.dir}`)
  saveResult.files.forEach((f) => console.log(`   - ${f.replace(MEMORY_DIR, "")}`))

  // 7. Submit a review
  console.log("\n7. Submitting review...")
  await mentee.submitReview(API_URL, sessionId, {
    rating: 5,
    comment: "Incredibly practical. Applied the Hook Writing technique the same day and saw 3x engagement.",
  })
  console.log("   Review submitted. ✅")

  mentee.disconnect()
  console.log("\nDone.")
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
