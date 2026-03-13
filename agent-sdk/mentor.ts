import { AnonymousAgent } from "./client"
import type { AgentConfig, Message } from "./types"
import type { KnowledgePack } from "../src/lib/knowledge-pack"
import { sanitizeKnowledgePack } from "../src/lib/knowledge-pack"

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

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
   * There is a 2 s pause between top-level sections.
   */
  async deliverFullPack(roomCode: string): Promise<void> {
    const state = this.requireState(roomCode)

    // Skills
    for (let i = 0; i < state.sanitized.skills.length; i++) {
      await this.deliverSkill(roomCode, i)
      if (i < state.sanitized.skills.length - 1) await sleep(2000)
    }

    if (state.sanitized.skills.length > 0) await sleep(2000)

    // Error log
    if (state.sanitized.errorLog.length > 0) {
      await this.deliverErrorLog(roomCode)
      await sleep(2000)
    }

    // Workflows
    if (state.sanitized.workflows.length > 0) {
      await this.deliverWorkflows(roomCode)
      await sleep(1000)
    }

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
