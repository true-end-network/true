import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { AnonymousAgent } from "./client"
import type { AgentConfig } from "./types"
import type { KnowledgePack, SkillEntry, WorkflowEntry } from "../src/lib/knowledge-pack"

// ---------------------------------------------------------------------------
// New types
// ---------------------------------------------------------------------------

export interface PackListing {
  id: string
  title: string
  mentor: { name: string; platform: string }
  category: string
  rating: number
  sessions: number
  pricing: { type: string; amount: number; currency: string }
  verified: boolean
  description: string
}

export interface PackDetail extends PackListing {
  pack: KnowledgePack
  reviews: Array<{ rating: number; comment: string; date: string }>
}

export interface KnowledgeModule {
  type: "skill" | "error_log" | "workflow" | "intro" | "complete"
  title: string
  content?: string
  index?: number
  total?: number
}

export interface ReceivedKnowledge {
  pack: KnowledgePack
  modules: KnowledgeModule[]
  durationMs: number
}

export interface SaveResult {
  dir: string
  files: string[]
  packTitle: string
}

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

function generateReadme(pack: KnowledgePack): string {
  const lines: string[] = [
    `# ${pack.title}`,
    ``,
    `> ${pack.description}`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Mentor | ${pack.mentor.name} (${pack.mentor.platform}) |`,
    `| Category | ${pack.category} |`,
    `| Version | ${pack.version} |`,
    `| Pack ID | \`${pack.id}\` |`,
    `| Date Received | ${formatDate()} |`,
    ``,
    `## Mentor Profile`,
    ``,
    `- **Experience:** ${pack.mentor.experience}`,
    `- **Specialties:** ${pack.mentor.specialties.join(", ")}`,
    ``,
    `### Results`,
    ``,
    ...Object.entries(pack.mentor.resultsSnapshot).map(([k, v]) => `- **${k}:** ${v}`),
    ``,
    `## Contents`,
    ``,
    `- **Skills:** ${pack.skills.length} (see \`skills/\`)`,
    `- **Error Log:** ${pack.errorLog.length} entries (see \`errors/errors.md\`)`,
    `- **Workflows:** ${pack.workflows.length} (see \`workflows/\`)`,
    `- **Templates:** ${pack.templates.length} (see \`templates/\`)`,
    ``,
    `## Metrics — ${pack.metrics.period}`,
    ``,
    ...Object.entries(pack.metrics.metrics).map(
      ([k, v]) =>
        `- **${k}:** ${v.value}${v.unit ? " " + v.unit : ""}${v.change ? " (" + v.change + ")" : ""}`
    ),
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

function generateErrorsFile(pack: KnowledgePack): string {
  const lines: string[] = [
    `# Common Mistakes to Avoid — ${pack.mentor.name}`,
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

function generateTemplateFile(template: { name: string; category: string; content: string; variables: string[]; usage: string }): string {
  const lines: string[] = [
    `# Template: ${template.name}`,
    ``,
    `**Category:** ${template.category}`,
    ``,
    `## Usage`,
    ``,
    template.usage,
    ``,
    `## Variables`,
    ``,
    ...template.variables.map((v) => `- \`${v}\``),
    ``,
    `## Content`,
    ``,
    "```",
    template.content,
    "```",
  ]
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// MenteeAgent
// ---------------------------------------------------------------------------

export class MenteeAgent extends AnonymousAgent {
  private packResolvers: Map<string, (pack: KnowledgePack) => void> = new Map()
  private packRejecters: Map<string, (err: Error) => void> = new Map()
  private moduleListeners: Map<string, (module: KnowledgeModule) => void> = new Map()
  private progressListeners: Map<string, (stage: string, percent: number) => void> = new Map()

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
        } else if (msg.type === "system") {
          // Fire progress / module events for system messages
          const onProgress = this.progressListeners.get(roomCode)
          const onModule = this.moduleListeners.get(roomCode)
          if (onProgress || onModule) {
            const content = msg.content ?? ""
            if (content.startsWith("## Skill ")) {
              const m = content.match(/Skill (\d+)\/(\d+):\s+(.+)/)
              if (m) {
                const [, idx, tot, title] = m
                onProgress?.(`skill:${idx}/${tot}`, Math.round((Number(idx) / Number(tot)) * 70))
                onModule?.({ type: "skill", title, index: Number(idx), total: Number(tot) })
              }
            } else if (content.startsWith("## Error Log")) {
              onProgress?.("error_log", 75)
              onModule?.({ type: "error_log", title: "Error Log" })
            } else if (content.startsWith("## Workflows")) {
              onProgress?.("workflows", 90)
              onModule?.({ type: "workflow", title: "Workflows" })
            } else if (content.startsWith("# Mentor Session Started")) {
              onProgress?.("intro", 5)
              onModule?.({ type: "intro", title: "Session Started" })
            }
          }
        }
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Pack discovery
  // ---------------------------------------------------------------------------

  /**
   * Browse available packs on the marketplace.
   */
  async browsePacks(
    apiUrl: string,
    filters?: {
      category?: string
      minRating?: number
      verified?: boolean
      search?: string
      sort?: "rating" | "price" | "sessions" | "newest"
    }
  ): Promise<PackListing[]> {
    const params = new URLSearchParams()
    if (filters?.category) params.set("category", filters.category)
    if (filters?.minRating != null) params.set("minRating", String(filters.minRating))
    if (filters?.verified != null) params.set("verified", String(filters.verified))
    if (filters?.search) params.set("search", filters.search)
    if (filters?.sort) params.set("sort", filters.sort)

    const qs = params.toString()
    const res = await fetch(`${apiUrl}/api/marketplace/packs${qs ? "?" + qs : ""}`)
    if (!res.ok) {
      throw new Error(`Failed to browse packs: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<PackListing[]>
  }

  /**
   * Fetch full details for a single pack.
   */
  async getPackDetails(apiUrl: string, packId: string): Promise<PackDetail> {
    const res = await fetch(`${apiUrl}/api/marketplace/packs/${encodeURIComponent(packId)}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch pack details: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<PackDetail>
  }

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  /**
   * Request a session for the given pack. Returns sessionId + roomCode to join.
   */
  async requestSession(apiUrl: string, packId: string): Promise<{ sessionId: string; roomCode: string }> {
    const res = await fetch(`${apiUrl}/api/marketplace/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId }),
    })
    if (!res.ok) {
      throw new Error(`Failed to request session: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<{ sessionId: string; roomCode: string }>
  }

  /**
   * Wait for a mentor to deliver a Knowledge Pack in the given room.
   * Resolves when the mentor sends the pack_complete message.
   * The room must already be joined before calling this method.
   */
  async receiveMentorSession(
    roomCode: string,
    opts?: {
      onProgress?: (stage: string, percent: number) => void
      onModuleReceived?: (module: KnowledgeModule) => void
      autoSave?: boolean
      memoryDir?: string
      timeoutMs?: number
    }
  ): Promise<ReceivedKnowledge> {
    const timeoutMs = opts?.timeoutMs ?? 300_000

    if (opts?.onProgress) this.progressListeners.set(roomCode, opts.onProgress)
    if (opts?.onModuleReceived) this.moduleListeners.set(roomCode, opts.onModuleReceived)

    const startTime = Date.now()

    const pack = await new Promise<KnowledgePack>((resolve, reject) => {
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

    // Clean up listeners
    this.progressListeners.delete(roomCode)
    this.moduleListeners.delete(roomCode)

    opts?.onProgress?.("complete", 100)

    const result: ReceivedKnowledge = {
      pack,
      modules: [],
      durationMs: Date.now() - startTime,
    }

    if (opts?.autoSave && opts.memoryDir) {
      await this.saveToMemory(pack, opts.memoryDir)
    }

    return result
  }

  /**
   * Send a question to the mentor in the room.
   */
  async askQuestion(roomCode: string, question: string): Promise<void> {
    await this.sendMessage(roomCode, question, "text")
  }

  /**
   * Submit a review for a completed session.
   */
  async submitReview(
    apiUrl: string,
    sessionId: string,
    review: { rating: number; comment: string }
  ): Promise<void> {
    const res = await fetch(`${apiUrl}/api/marketplace/sessions/${encodeURIComponent(sessionId)}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review),
    })
    if (!res.ok) {
      throw new Error(`Failed to submit review: ${res.status} ${await res.text()}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Knowledge persistence
  // ---------------------------------------------------------------------------

  /**
   * Save a Knowledge Pack as organized markdown files.
   *
   * Structure:
   *  - {memoryDir}/academy/{pack-slug}/README.md      — overview
   *  - {memoryDir}/academy/{pack-slug}/skills/         — one file per skill
   *  - {memoryDir}/academy/{pack-slug}/workflows/      — one file per workflow
   *  - {memoryDir}/academy/{pack-slug}/errors/         — common mistakes
   *  - {memoryDir}/academy/{pack-slug}/templates/      — reusable templates
   */
  async saveToMemory(pack: KnowledgePack, memoryDir: string): Promise<SaveResult> {
    const packSlug = toSlug(pack.title)
    const packDir = join(memoryDir, "academy", packSlug)

    const skillsDir = join(packDir, "skills")
    const workflowsDir = join(packDir, "workflows")
    const errorsDir = join(packDir, "errors")
    const templatesDir = join(packDir, "templates")

    await mkdir(skillsDir, { recursive: true })
    await mkdir(workflowsDir, { recursive: true })
    await mkdir(errorsDir, { recursive: true })
    await mkdir(templatesDir, { recursive: true })

    const files: string[] = []

    // README overview
    const readmePath = join(packDir, "README.md")
    await writeFile(readmePath, generateReadme(pack), "utf-8")
    files.push(readmePath)

    // Skills — one file per skill
    for (const skill of pack.skills) {
      const skillSlug = toSlug(skill.name)
      const skillPath = join(skillsDir, `${skillSlug}.md`)
      await writeFile(skillPath, generateSkillFile(skill), "utf-8")
      files.push(skillPath)
    }

    // Errors — combined file
    if (pack.errorLog.length > 0) {
      const errorsPath = join(errorsDir, "errors.md")
      await writeFile(errorsPath, generateErrorsFile(pack), "utf-8")
      files.push(errorsPath)
    }

    // Workflows — one file per workflow
    for (const workflow of pack.workflows) {
      const workflowSlug = toSlug(workflow.name)
      const workflowPath = join(workflowsDir, `${workflowSlug}.md`)
      await writeFile(workflowPath, generateWorkflowFile(workflow), "utf-8")
      files.push(workflowPath)
    }

    // Templates — one file per template
    for (const template of pack.templates) {
      const templateSlug = toSlug(template.name)
      const templatePath = join(templatesDir, `${templateSlug}.md`)
      await writeFile(templatePath, generateTemplateFile(template), "utf-8")
      files.push(templatePath)
    }

    return { dir: packDir, files, packTitle: pack.title }
  }
}
