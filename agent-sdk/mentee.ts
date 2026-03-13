import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { AnonymousAgent } from "./client"
import type { AgentConfig } from "./types"
import type { KnowledgePack, SkillEntry, WorkflowEntry } from "../src/lib/knowledge-pack"

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
  return name
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
}

function formatDate(date = new Date()): string {
  return date.toISOString().split("T")[0]
}

function generateSessionLog(pack: KnowledgePack, date: string): string {
  const lines: string[] = [
    `# Mentor Session: ${pack.title}`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Date | ${date} |`,
    `| Mentor | ${pack.mentor.name} (${pack.mentor.platform}) |`,
    `| Category | ${pack.category} |`,
    `| Version | ${pack.version} |`,
    `| Pack ID | \`${pack.id}\` |`,
    ``,
    `## Description`,
    ``,
    pack.description,
    ``,
    `## Mentor Profile`,
    ``,
    `- **Experience:** ${pack.mentor.experience}`,
    `- **Specialties:** ${pack.mentor.specialties.join(", ")}`,
    ``,
    `### Results Snapshot`,
    ``,
    ...Object.entries(pack.mentor.resultsSnapshot).map(([k, v]) => `- **${k}:** ${v}`),
    ``,
    `## Skills (${pack.skills.length})`,
    ``,
    ...pack.skills.map((s, i) => `${i + 1}. **${s.name}** — ${s.category}, ${s.difficulty}`),
    ``,
    `## Error Log Summary (${pack.errorLog.length} entries)`,
    ``,
    ...pack.errorLog.map((e) => `- \`${e.date}\` ${e.description}`),
    ``,
    `## Workflows (${pack.workflows.length})`,
    ``,
    ...pack.workflows.map((w) => `- **${w.name}**: ${w.description}`),
    ``,
    `## Metrics — ${pack.metrics.period}`,
    ``,
    ...Object.entries(pack.metrics.metrics).map(
      ([k, v]) =>
        `- **${k}:** ${v.value}${v.unit ? " " + v.unit : ""}${v.change ? " (" + v.change + ")" : ""}`
    ),
    `- **Independently verifiable:** ${pack.metrics.verifiable ? "Yes" : "No"}`,
    ``,
    `## Pricing`,
    ``,
    `- **Type:** ${pack.pricing.type}`,
    `- **Amount:** ${pack.pricing.amount} ${pack.pricing.currency}`,
    `- **Trial available:** ${pack.pricing.trialAvailable ? "Yes" : "No"}`,
  ]
  return lines.join("\n")
}

function generateSkillFile(skill: SkillEntry): string {
  const lines: string[] = [
    `# ${skill.name}`,
    ``,
    `**Category:** ${skill.category} | **Difficulty:** ${skill.difficulty}`,
    ``,
    skill.content,
  ]

  if (skill.examples.length > 0) {
    lines.push(``, `## Examples`, ``)
    skill.examples.forEach((ex, i) => lines.push(`${i + 1}. ${ex}`))
  }

  if (skill.pitfalls.length > 0) {
    lines.push(``, `## Common Pitfalls`, ``)
    skill.pitfalls.forEach((p) => lines.push(`- ⚠️ ${p}`))
  }

  return lines.join("\n")
}

function generateErrorLogFile(pack: KnowledgePack): string {
  const lines: string[] = [
    `# Error Log — ${pack.mentor.name}`,
    ``,
    `_Source: ${pack.title} v${pack.version}_`,
    ``,
  ]

  for (const entry of pack.errorLog) {
    lines.push(
      `## [${entry.date}] ${entry.description}`,
      ``,
      `**Impact:** ${entry.impact}`,
      ``,
      `**Fix:** ${entry.fix}`,
      ``,
      `> **Lesson:** ${entry.lesson}`,
      ``
    )
  }

  return lines.join("\n")
}

function generateWorkflowFile(workflow: WorkflowEntry): string {
  const lines: string[] = [
    `# Workflow: ${workflow.name}`,
    ``,
    workflow.description,
    ``,
    `## Steps`,
    ``,
    ...workflow.steps.map(
      (s) => `${s.step}. ${s.action}${s.notes ? `\n   > ${s.notes}` : ""}`
    ),
    ``,
    `## When to Use`,
    ``,
    ...workflow.triggers.map((t) => `- ${t}`),
  ]
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// MenteeAgent
// ---------------------------------------------------------------------------

export class MenteeAgent extends AnonymousAgent {
  private packResolvers: Map<string, (pack: KnowledgePack) => void> = new Map()
  private packRejecters: Map<string, (err: Error) => void> = new Map()

  constructor(relayUrl: string, config?: Partial<Omit<AgentConfig, "relayUrl">>) {
    super(relayUrl, config)
    // Listen for the pack_complete sentinel sent by MentorAgent.deliverFullPack()
    this.on({
      onMessage: (msg, _envelope, roomCode) => {
        if (msg.type === "system" && msg.metadata?.type === "pack_complete" && msg.metadata.pack) {
          const resolver = this.packResolvers.get(roomCode)
          if (resolver) {
            this.packResolvers.delete(roomCode)
            this.packRejecters.delete(roomCode)
            resolver(msg.metadata.pack as KnowledgePack)
          }
        }
      },
    })
  }

  /**
   * Wait for a mentor to deliver a Knowledge Pack in the given room.
   * Resolves when the mentor sends the pack_complete message.
   * The room must already be joined before calling this method.
   *
   * @param roomCode  Room code (must already be joined)
   * @param timeoutMs Milliseconds before giving up (default 5 minutes)
   */
  async receiveMentorSession(roomCode: string, timeoutMs = 300_000): Promise<KnowledgePack> {
    return new Promise((resolve, reject) => {
      this.packResolvers.set(roomCode, resolve)
      this.packRejecters.set(roomCode, reject)

      setTimeout(() => {
        if (this.packResolvers.has(roomCode)) {
          this.packResolvers.delete(roomCode)
          this.packRejecters.delete(roomCode)
          reject(new Error(`Timeout waiting for mentor session in room "${roomCode}"`))
        }
      }, timeoutMs)
    })
  }

  /**
   * Send a question to the mentor in the room.
   */
  async askQuestion(roomCode: string, question: string): Promise<void> {
    await this.sendMessage(roomCode, question, "text")
  }

  /**
   * Persist a Knowledge Pack to disk as organized markdown files.
   *
   * Generates:
   *  - {memoryDir}/mentor-{mentorName}-{date}.md      — session log
   *  - {memoryDir}/skills/{category}/{skill}.md        — per-skill files
   *  - {memoryDir}/error-log-{mentorName}.md           — error lessons
   *  - {memoryDir}/workflows/{workflow}.md             — workflow files
   */
  async saveToMemory(pack: KnowledgePack, memoryDir: string): Promise<void> {
    const mentorSlug = toSlug(pack.mentor.name)
    const date = formatDate()

    const skillsDir = join(memoryDir, "skills")
    const workflowsDir = join(memoryDir, "workflows")

    await mkdir(skillsDir, { recursive: true })
    await mkdir(workflowsDir, { recursive: true })

    // Session log
    await writeFile(
      join(memoryDir, `mentor-${mentorSlug}-${date}.md`),
      generateSessionLog(pack, date),
      "utf-8"
    )

    // Skills — one file per skill, organized into category sub-directories
    for (const skill of pack.skills) {
      const categoryDir = join(skillsDir, skill.category)
      await mkdir(categoryDir, { recursive: true })
      const skillSlug = toSlug(skill.name)
      await writeFile(join(categoryDir, `${skillSlug}.md`), generateSkillFile(skill), "utf-8")
    }

    // Error log
    await writeFile(
      join(memoryDir, `error-log-${mentorSlug}.md`),
      generateErrorLogFile(pack),
      "utf-8"
    )

    // Workflows
    for (const workflow of pack.workflows) {
      const workflowSlug = toSlug(workflow.name)
      await writeFile(
        join(workflowsDir, `${workflowSlug}.md`),
        generateWorkflowFile(workflow),
        "utf-8"
      )
    }
  }
}
