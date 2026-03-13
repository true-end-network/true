/**
 * Mentor Example
 * Shows: register pack → upload proof → wait for student → deliver → check stats
 *
 * Usage:
 *   npx ts-node agent-sdk/examples/mentor-example.ts
 */

import { MentorAgent } from "../mentor"
import { generatePackId, SkillCategory } from "../../src/lib/knowledge-pack"
import type { KnowledgePack } from "../../src/lib/knowledge-pack"

const RELAY_URL = process.env.RELAY_URL ?? "ws://localhost:3001"
const API_URL = process.env.API_URL ?? "http://localhost:3000"
const MENTOR_ID = process.env.MENTOR_ID ?? "mentor-001"

// ---------------------------------------------------------------------------
// Sample knowledge pack
// ---------------------------------------------------------------------------

function buildSamplePack(): KnowledgePack {
  const partial = {
    id: "",
    version: "1.0.0",
    mentor: {
      name: "Alice Growth",
      platform: "X / Twitter",
      specialties: ["social-media", "content-creation"],
      experience: "3 years, 50K+ followers built",
      resultsSnapshot: {
        followers: "52K",
        avgEngagement: "4.2%",
        monthlyImpressions: "1.2M",
      },
    },
    category: SkillCategory.SocialMedia,
    title: "Social Media Growth Playbook",
    description: "Proven strategies to grow from 0 to 50K engaged followers in 12 months.",
    skills: [
      {
        name: "Hook Writing",
        category: "content-creation",
        difficulty: "intermediate" as const,
        content:
          "The first line of every post is your hook. It must create curiosity or promise value. Use numbers, questions, or bold claims.",
        examples: [
          "I grew 10K followers in 30 days. Here's exactly how:",
          "Most people fail at X because they ignore this one thing:",
        ],
        pitfalls: [
          "Starting with 'I' — readers don't care about you yet",
          "Being too vague — specificity converts",
        ],
      },
      {
        name: "Posting Schedule",
        category: "social-media",
        difficulty: "beginner" as const,
        content: "Consistency beats frequency. Post 1–2 times per day at peak times: 7–9am and 5–7pm your audience's timezone.",
        examples: [
          "Morning educational thread + evening opinion post",
        ],
        pitfalls: [
          "Posting at random times — the algorithm penalises inconsistency",
          "Skipping weekends — Saturday morning is high engagement",
        ],
      },
    ],
    errorLog: [
      {
        date: "2024-03-10",
        description: "Posted 5 times in one day after a viral thread",
        impact: "Engagement dropped 60% on subsequent posts",
        fix: "Spaced posts back to 2/day max",
        lesson: "Algorithm penalises sudden spikes in post frequency",
      },
    ],
    workflows: [
      {
        name: "Weekly Content Sprint",
        description: "Batch-create a full week of content in 3 hours on Sunday.",
        steps: [
          { step: 1, action: "Brain-dump 20 topic ideas", notes: "Use Notion voice memo" },
          { step: 2, action: "Pick the 7 best and assign formats (thread, short, poll)" },
          { step: 3, action: "Write all drafts in Buffer" },
          { step: 4, action: "Schedule for the week" },
        ],
        triggers: ["Start of each week", "Before a planned vacation"],
      },
    ],
    toolConfigs: [],
    templates: [
      {
        name: "Viral Thread Opener",
        category: "content-creation",
        content: "{{number}} {{outcome}} in {{timeframe}}. Here's the exact playbook:",
        variables: ["number", "outcome", "timeframe"],
        usage: "Use at the start of any educational thread",
      },
    ],
    metrics: {
      period: "12 months",
      metrics: {
        followers: { value: "52000", change: "+52000" },
        avgEngagement: { value: "4.2", unit: "%", change: "+2.1%" },
        monthlyImpressions: { value: "1.2", unit: "M" },
      },
      verifiable: true,
    },
    pricing: {
      type: "per-session" as const,
      amount: 49,
      currency: "USD" as const,
      trialAvailable: true,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      language: "en",
      tags: ["social-media", "growth", "content"],
      targetAudience: "Creators and solopreneurs with under 5K followers",
      prerequisites: ["Active X account", "Basic writing skills"],
    },
  }

  const pack = { ...partial, id: "" }
  pack.id = generatePackId(pack as KnowledgePack)
  return pack as KnowledgePack
}

// ---------------------------------------------------------------------------
// Main mentor flow
// ---------------------------------------------------------------------------

async function main() {
  const pack = buildSamplePack()
  const mentor = new MentorAgent(RELAY_URL, { name: "Alice Growth Bot" })

  console.log("Connecting to relay...")
  await mentor.connect()
  console.log("Connected.")

  // 1. Register pack on marketplace
  console.log("\n1. Registering pack on marketplace...")
  const packId = await mentor.registerAsMentor(API_URL, pack)
  console.log(`   Pack registered: ${packId}`)

  // 2. Upload engagement proof
  console.log("\n2. Uploading engagement proof...")
  const proof = await mentor.uploadEngagementProof(API_URL, packId, {
    platform: "x",
    type: "api_verified",
    metrics: {
      followers: 52000,
      engagement: 4.2,
      views: 1200000,
    },
  })
  console.log(`   Verification: ${proof.verified ? "✅ verified" : "⚠️ pending"} (${proof.method})`)

  // 3. Poll for a pending session
  console.log("\n3. Waiting for a student to enroll...")
  console.log("   (In production this would poll listMySessions)")

  let sessions = await mentor.listMySessions(API_URL, MENTOR_ID)
  console.log(`   Found ${sessions.length} sessions`)

  const pending = sessions.find((s) => s.packId === packId && s.status === "pending")
  if (!pending) {
    console.log("   No pending sessions yet — simulating one for demo purposes")
    // In real usage you'd loop/poll until a student enrolls
    mentor.disconnect()
    return
  }

  // 4. Accept the session
  console.log(`\n4. Accepting session ${pending.sessionId}...`)
  await mentor.acceptSession(API_URL, pending.sessionId)

  // 5. Create / join the session room and deliver
  console.log("\n5. Joining room and delivering pack...")
  await mentor.joinRoom(pending.roomCode)
  await mentor.startMentorSession(pending.roomCode, pack)

  const result = await mentor.deliverFullPack(pending.roomCode, {
    pauseBetweenModules: 1000,
    interactive: false,
    onProgress: (stage, pct) => {
      process.stdout.write(`\r   Progress: ${pct}% — ${stage}    `)
    },
  })
  console.log("\n   Delivery complete:", result)

  // 6. Check stats
  console.log("\n6. Checking my stats...")
  const stats = await mentor.getMyStats(API_URL, MENTOR_ID)
  console.log("   Stats:", stats)

  mentor.disconnect()
  console.log("\nDone.")
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
