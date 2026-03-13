import { readFile } from "fs/promises"
import { AnonymousAgent } from "./client"
import type { AgentConfig, Message } from "./types"
import type { KnowledgePack } from "../src/lib/knowledge-pack"
import { sanitizeKnowledgePack } from "../src/lib/knowledge-pack"

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// New types
// ---------------------------------------------------------------------------

export interface PlatformMetrics {
  followers?: number
  views?: number
  engagement?: number
  revenue?: number
  [key: string]: number | undefined
}

export interface VerificationResult {
  verified: boolean
  packId: string
  method: "screenshot" | "api_verified"
  timestamp: string
  message?: string
}

export interface MentorSession {
  sessionId: string
  packId: string
  menteeId: string
  roomCode: string
  status: "pending" | "accepted" | "in_progress" | "completed"
  createdAt: string
}

export interface MentorStats {
  totalSessions: number
  completedSessions: number
  averageRating: number
  totalReviews: number
  totalRevenue: number
  currency: string
  topPack?: string
}

export interface DeliveryResult {
  roomCode: string
  skillsDelivered: number
  errorsDelivered: number
  workflowsDelivered: number
  durationMs: number
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface RoomDeliveryState {
  pack: KnowledgePack
  sanitized: KnowledgePack
  deliveredSkills: Set<number>
  errorLogDelivered: boolean
  workflowsDelivered: boolean
}

export class MentorAgent extends AnonymousAgent {
  private deliveryStates: Map<string, RoomDeliveryState> = new Map()
  private incomingMessages: Map<string, Message[]> = new Map()

  constructor(relayUrl: string, config?: Partial<Omit<AgentConfig, "relayUrl">>) {
    super(relayUrl, config)
    // Accumulate incoming messages per room for waitForQuestions()
    this.on({
      onMessage: (msg, _envelope, roomCode) => {
        const msgs = this.incomingMessages.get(roomCode)
        if (msgs) msgs.push(msg)
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Marketplace / API methods
  // ---------------------------------------------------------------------------

  /**
   * Register this agent as a mentor by posting a pack to the marketplace.
   * Returns the assigned pack ID.
   */
  async registerAsMentor(apiUrl: string, pack: KnowledgePack): Promise<string> {
    const res = await fetch(`${apiUrl}/api/marketplace/packs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pack),
    })
    if (!res.ok) {
      throw new Error(`Failed to register pack: ${res.status} ${await res.text()}`)
    }
    const data = await res.json() as { id?: string; packId?: string }
    const id = data.id ?? data.packId
    if (!id) throw new Error("Server did not return a pack ID")
    return id
  }

  /**
   * Upload engagement proof (screenshot or API-verified) for a pack.
   */
  async uploadEngagementProof(
    apiUrl: string,
    packId: string,
    proof: {
      platform: "x" | "instagram" | "tiktok" | "youtube"
      type: "screenshot" | "api_verified"
      screenshotPath?: string
      metrics: PlatformMetrics
    }
  ): Promise<VerificationResult> {
    if (proof.type === "screenshot") {
      // Read file and convert to base64
      if (!proof.screenshotPath) {
        throw new Error("screenshotPath is required for screenshot proof type")
      }
      const buf = await readFile(proof.screenshotPath)
      const base64 = buf.toString("base64")

      const res = await fetch(`${apiUrl}/api/marketplace/packs/${packId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: proof.platform,
          type: proof.type,
          screenshot: base64,
          metrics: proof.metrics,
        }),
      })
      if (!res.ok) {
        throw new Error(`Failed to upload proof: ${res.status} ${await res.text()}`)
      }
      return res.json() as Promise<VerificationResult>
    } else {
      // API-verified: POST to verify endpoint
      const res = await fetch(`${apiUrl}/api/marketplace/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId,
          platform: proof.platform,
          type: proof.type,
          metrics: proof.metrics,
        }),
      })
      if (!res.ok) {
        throw new Error(`Failed to verify proof: ${res.status} ${await res.text()}`)
      }
      return res.json() as Promise<VerificationResult>
    }
  }

  /**
   * List all sessions where this mentor is assigned.
   */
  async listMySessions(apiUrl: string, mentorId: string): Promise<MentorSession[]> {
    const res = await fetch(`${apiUrl}/api/marketplace/sessions?mentorId=${encodeURIComponent(mentorId)}`)
    if (!res.ok) {
      throw new Error(`Failed to list sessions: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<MentorSession[]>
  }

  /**
   * Accept a pending session request.
   */
  async acceptSession(apiUrl: string, sessionId: string): Promise<void> {
    const res = await fetch(`${apiUrl}/api/marketplace/sessions/${encodeURIComponent(sessionId)}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) {
      throw new Error(`Failed to accept session: ${res.status} ${await res.text()}`)
    }
  }

  /**
   * Fetch stats for this mentor (total sessions, rating, revenue, etc.).
   */
  async getMyStats(apiUrl: string, mentorId: string): Promise<MentorStats> {
    const res = await fetch(`${apiUrl}/api/marketplace/mentors/${encodeURIComponent(mentorId)}/stats`)
    if (!res.ok) {
      throw new Error(`Failed to fetch stats: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<MentorStats>
  }

  // ---------------------------------------------------------------------------
  // Session / delivery methods
  // ---------------------------------------------------------------------------

  /**
   * Begin a mentor session for a room. Stores the pack and sends an intro message.
   * Must be called before any deliver* methods.
   */
  async startMentorSession(roomCode: string, pack: KnowledgePack): Promise<void> {
    const sanitized = sanitizeKnowledgePack(pack)
    this.deliveryStates.set(roomCode, {
      pack,
      sanitized,
      deliveredSkills: new Set(),
      errorLogDelivered: false,
      workflowsDelivered: false,
    })
    this.incomingMessages.set(roomCode, [])

    await this.sendMessage(
      roomCode,
      [
        `# Mentor Session Started`,
        `**Mentor:** ${sanitized.mentor.name} (${sanitized.mentor.platform})`,
        `**Pack:** ${sanitized.title}  v${sanitized.version}`,
        sanitized.description,
        ``,
        `📚 Skills: **${sanitized.skills.length}** | 🐛 Error log: **${sanitized.errorLog.length}** | ⚙️ Workflows: **${sanitized.workflows.length}**`,
      ].join("\n"),
      "system"
    )
  }

  /**
   * Send a single skill by index (0-based). Requires startMentorSession().
   */
  async deliverSkill(roomCode: string, skillIndex: number): Promise<void> {
    const state = this.requireState(roomCode)
    const skill = state.sanitized.skills[skillIndex]
    if (!skill) {
      throw new Error(`Skill index ${skillIndex} out of range (pack has ${state.sanitized.skills.length} skills)`)
    }

    await this.sendMessage(
      roomCode,
      `## Skill ${skillIndex + 1}/${state.sanitized.skills.length}: ${skill.name}\n_Category: ${skill.category} | Difficulty: ${skill.difficulty}_`,
      "system"
    )
    await sleep(500)

    await this.sendMessage(roomCode, skill.content, "text")

    if (skill.examples.length > 0) {
      await sleep(500)
      await this.sendMessage(
        roomCode,
        `**Examples:**\n` + skill.examples.map((ex, i) => `${i + 1}. ${ex}`).join("\n"),
        "text"
      )
    }

    if (skill.pitfalls.length > 0) {
      await sleep(500)
      await this.sendMessage(
        roomCode,
        `**Common Pitfalls:**\n` + skill.pitfalls.map((p) => `- ⚠️ ${p}`).join("\n"),
        "text"
      )
    }

    state.deliveredSkills.add(skillIndex)
  }

  /**
   * Deliver all error log entries. Requires startMentorSession().
   */
  async deliverErrorLog(roomCode: string): Promise<void> {
    const state = this.requireState(roomCode)

    await this.sendMessage(
      roomCode,
      `## Error Log\n_${state.sanitized.errorLog.length} real mistakes and lessons learned_`,
      "system"
    )
    await sleep(500)

    for (const entry of state.sanitized.errorLog) {
      await this.sendMessage(
        roomCode,
        [
          `**📅 ${entry.date}**`,
          `**Issue:** ${entry.description}`,
          `**Impact:** ${entry.impact}`,
          `**Fix:** ${entry.fix}`,
          `**Lesson:** ${entry.lesson}`,
        ].join("\n"),
        "text"
      )
      await sleep(500)
    }

    state.errorLogDelivered = true
  }

  /**
   * Deliver all workflow entries. Requires startMentorSession().
   */
  async deliverWorkflows(roomCode: string): Promise<void> {
    const state = this.requireState(roomCode)

    await this.sendMessage(
      roomCode,
      `## Workflows\n_${state.sanitized.workflows.length} task automation chains_`,
      "system"
    )
    await sleep(500)

    for (const workflow of state.sanitized.workflows) {
      const steps = workflow.steps
        .map((s) => `${s.step}. ${s.action}${s.notes ? ` _(${s.notes})_` : ""}`)
        .join("\n")
      const triggers = workflow.triggers.map((t) => `- ${t}`).join("\n")

      await this.sendMessage(
        roomCode,
        [
          `### ${workflow.name}`,
          workflow.description,
          ``,
          `**Steps:**\n${steps}`,
          ``,
          `**Triggers:**\n${triggers}`,
        ].join("\n"),
        "text"
      )
      await sleep(500)
    }

    state.workflowsDelivered = true
  }

  /**
   * Deliver all content in sequence (skills → error log → workflows → pack_complete).
   * Supports progress callbacks, configurable pause between modules, and optional
   * interactive Q&A pauses between sections.
   */
  async deliverFullPack(
    roomCode: string,
    opts?: {
      onProgress?: (stage: string, percent: number) => void
      pauseBetweenModules?: number  // ms — default 2000
      interactive?: boolean          // allow Q&A between modules
    }
  ): Promise<DeliveryResult> {
    const state = this.requireState(roomCode)
    const pause = opts?.pauseBetweenModules ?? 2000
    const onProgress = opts?.onProgress
    const interactive = opts?.interactive ?? false
    const startTime = Date.now()

    const total =
      state.sanitized.skills.length +
      (state.sanitized.errorLog.length > 0 ? 1 : 0) +
      (state.sanitized.workflows.length > 0 ? 1 : 0)
    let done = 0

    const tick = (stage: string) => {
      onProgress?.(stage, total > 0 ? Math.round((done / total) * 100) : 100)
    }

    // Skills
    for (let i = 0; i < state.sanitized.skills.length; i++) {
      tick(`skill:${i + 1}/${state.sanitized.skills.length}`)
      await this.deliverSkill(roomCode, i)
      done++
      if (i < state.sanitized.skills.length - 1) await sleep(pause)
    }

    if (state.sanitized.skills.length > 0) {
      if (interactive) {
        await this.sendMessage(roomCode, "💬 Skills delivered. Any questions before we continue?", "system")
        await sleep(pause * 2)
      } else {
        await sleep(pause)
      }
    }

    // Error log
    if (state.sanitized.errorLog.length > 0) {
      tick("error_log")
      await this.deliverErrorLog(roomCode)
      done++
      if (interactive) {
        await this.sendMessage(roomCode, "💬 Error log delivered. Any questions?", "system")
        await sleep(pause * 2)
      } else {
        await sleep(pause)
      }
    }

    // Workflows
    if (state.sanitized.workflows.length > 0) {
      tick("workflows")
      await this.deliverWorkflows(roomCode)
      done++
      await sleep(Math.min(pause, 1000))
    }

    onProgress?.("complete", 100)

    // Final message — carries the full sanitized pack so the mentee can reconstruct it
    await this.send(roomCode, {
      type: "system",
      content: "✅ Knowledge Pack delivery complete.",
      metadata: {
        type: "pack_complete",
        packId: state.sanitized.id,
        title: state.sanitized.title,
        pack: state.sanitized,
      },
    })

    return {
      roomCode,
      skillsDelivered: state.sanitized.skills.length,
      errorsDelivered: state.sanitized.errorLog.length,
      workflowsDelivered: state.sanitized.workflows.length,
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Clear the message buffer for the room, wait timeoutMs, then return whatever
   * messages arrived during that window. Useful for a Q&A phase after delivery.
   */
  async waitForQuestions(roomCode: string, timeoutMs: number): Promise<Message[]> {
    this.incomingMessages.set(roomCode, [])
    await sleep(timeoutMs)
    return [...(this.incomingMessages.get(roomCode) ?? [])]
  }

  // ---------------------------------------------------------------------------

  private requireState(roomCode: string): RoomDeliveryState {
    const state = this.deliveryStates.get(roomCode)
    if (!state) {
      throw new Error(
        `No active mentor session for room "${roomCode}". Call startMentorSession() first.`
      )
    }
    return state
  }
}
