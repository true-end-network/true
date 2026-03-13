import { createHash } from "crypto"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum SkillCategory {
  SocialMedia = "social-media",
  CryptoIntel = "crypto-intel",
  Sales = "sales",
  ContentCreation = "content-creation",
  DevOps = "devops",
  Analytics = "analytics",
  Productivity = "productivity",
  SmartHome = "smart-home",
  DeFi = "defi",
  Trading = "trading",
}

// ---------------------------------------------------------------------------
// Sub-interfaces
// ---------------------------------------------------------------------------

export interface MentorProfile {
  name: string                            // e.g. "Major 🎖️"
  platform: string                        // e.g. "OpenClaw"
  specialties: string[]
  experience: string                      // e.g. "6 weeks, 24/7 operation"
  resultsSnapshot: Record<string, string> // e.g. {"followers": "14.4K"}
}

export interface SkillEntry {
  name: string
  category: string
  difficulty: "beginner" | "intermediate" | "advanced"
  content: string                         // markdown instruction
  examples: string[]                      // real examples
  pitfalls: string[]                      // common mistakes
}

export interface ErrorEntry {
  date: string
  description: string
  impact: string                          // what went wrong
  fix: string                             // how it was fixed
  lesson: string                          // what to learn
}

export interface WorkflowStep {
  step: number
  action: string
  notes?: string
}

export interface WorkflowEntry {
  name: string
  description: string
  steps: WorkflowStep[]
  triggers: string[]                      // when to use this workflow
}

export interface ToolConfig {
  name: string
  purpose: string
  setupSteps: string[]
  configuration: Record<string, string>  // NO secrets — safe config keys only
  notes: string
}

export interface Template {
  name: string
  category: string
  content: string
  variables: string[]
  usage: string
}

export interface MetricValue {
  value: string
  unit?: string
  change?: string
}

export interface MetricsProof {
  period: string                          // e.g. "6 weeks"
  metrics: Record<string, MetricValue>
  screenshots?: string[]                  // base64 or URLs
  verifiable: boolean                     // can buyer verify independently?
}

export interface Pricing {
  type: "one-time" | "subscription" | "per-session"
  amount: number
  currency: "USD" | "USDT" | "ETH" | "SOL" | "BRL"
  trialAvailable: boolean
}

export interface PackMetadata {
  createdAt: string                       // ISO date string
  updatedAt: string
  language: string                        // e.g. "en"
  tags: string[]
  targetAudience: string
  prerequisites: string[]
}

// ---------------------------------------------------------------------------
// Root interface
// ---------------------------------------------------------------------------

export interface KnowledgePack {
  id: string                              // SHA-256 hash
  version: string                         // semver
  mentor: MentorProfile
  category: SkillCategory
  title: string                           // e.g. "Social Media Mastery"
  description: string
  skills: SkillEntry[]
  errorLog: ErrorEntry[]
  workflows: WorkflowEntry[]
  toolConfigs: ToolConfig[]
  templates: Template[]
  metrics: MetricsProof
  pricing: Pricing
  metadata: PackMetadata
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"])
const VALID_PRICING_TYPES = new Set(["one-time", "subscription", "per-session"])
const VALID_CURRENCIES = new Set(["USD", "USDT", "ETH", "SOL", "BRL"])
const VALID_CATEGORIES = new Set(Object.values(SkillCategory))

function isString(v: unknown): v is string {
  return typeof v === "string"
}
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

export function validateKnowledgePack(pack: unknown): pack is KnowledgePack {
  if (!isObject(pack)) return false

  // Top-level primitives
  if (!isString(pack.id) || !pack.id) return false
  if (!isString(pack.version) || !pack.version) return false
  if (!isString(pack.title) || !pack.title) return false
  if (!isString(pack.description)) return false
  if (!VALID_CATEGORIES.has(pack.category as SkillCategory)) return false

  // Mentor
  if (!isObject(pack.mentor)) return false
  const m = pack.mentor
  if (!isString(m.name) || !isString(m.platform) || !isString(m.experience)) return false
  if (!Array.isArray(m.specialties)) return false
  if (!isObject(m.resultsSnapshot)) return false

  // Arrays
  if (!Array.isArray(pack.skills)) return false
  if (!Array.isArray(pack.errorLog)) return false
  if (!Array.isArray(pack.workflows)) return false
  if (!Array.isArray(pack.toolConfigs)) return false
  if (!Array.isArray(pack.templates)) return false

  // Validate skill entries
  for (const skill of pack.skills as unknown[]) {
    if (!isObject(skill)) return false
    if (!isString(skill.name) || !isString(skill.category) || !isString(skill.content)) return false
    if (!VALID_DIFFICULTIES.has(skill.difficulty as string)) return false
    if (!Array.isArray(skill.examples) || !Array.isArray(skill.pitfalls)) return false
  }

  // Validate error entries
  for (const entry of pack.errorLog as unknown[]) {
    if (!isObject(entry)) return false
    if (!isString(entry.date) || !isString(entry.description)) return false
    if (!isString(entry.impact) || !isString(entry.fix) || !isString(entry.lesson)) return false
  }

  // Validate workflow entries
  for (const wf of pack.workflows as unknown[]) {
    if (!isObject(wf)) return false
    if (!isString(wf.name) || !isString(wf.description)) return false
    if (!Array.isArray(wf.steps) || !Array.isArray(wf.triggers)) return false
    for (const step of wf.steps as unknown[]) {
      if (!isObject(step)) return false
      if (typeof step.step !== "number" || !isString(step.action)) return false
    }
  }

  // Metrics
  if (!isObject(pack.metrics)) return false
  if (!isString(pack.metrics.period)) return false
  if (!isObject(pack.metrics.metrics)) return false
  if (typeof pack.metrics.verifiable !== "boolean") return false

  // Pricing
  if (!isObject(pack.pricing)) return false
  if (!VALID_PRICING_TYPES.has(pack.pricing.type as string)) return false
  if (typeof pack.pricing.amount !== "number") return false
  if (!VALID_CURRENCIES.has(pack.pricing.currency as string)) return false
  if (typeof pack.pricing.trialAvailable !== "boolean") return false

  // Metadata
  if (!isObject(pack.metadata)) return false
  const md = pack.metadata
  if (!isString(md.createdAt) || !isString(md.updatedAt) || !isString(md.language)) return false
  if (!isString(md.targetAudience)) return false
  if (!Array.isArray(md.tags) || !Array.isArray(md.prerequisites)) return false

  return true
}

// ---------------------------------------------------------------------------
// Sanitization — strip potential secrets from all string fields
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: RegExp[] = [
  // OpenAI / Anthropic style keys
  /sk-[a-zA-Z0-9\-]{20,}/g,
  // GitHub tokens
  /ghp_[a-zA-Z0-9]{36}/g,
  /github_pat_[a-zA-Z0-9_]{59}/g,
  // AWS access keys
  /AKIA[A-Z0-9]{16}/g,
  // URLs with embedded credentials  (http://user:pass@host)
  /https?:\/\/[^:@\s/]+:[^@\s/]+@\S+/g,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9\-._~+/]{20,}=*/g,
  // JWT tokens  (eyJ...base64.base64.base64)
  /eyJ[a-zA-Z0-9\-_]{20,}\.[a-zA-Z0-9\-_]{5,}\.[a-zA-Z0-9\-_]*/g,
  // Generic key=value patterns with long values
  /(?:api[_-]?key|access[_-]?token|secret[_-]?key|private[_-]?key)\s*[:=]\s*["']?[\w\-.+=]{16,}["']?/gi,
  // Assignment patterns: PASSWORD=xxx, SECRET=xxx, TOKEN=xxx
  /\b(?:PASSWORD|PASSWD|SECRET|TOKEN|CREDENTIAL)\s*=\s*["']?\S+["']?/g,
]

function stripSecrets(value: string): string {
  let result = value
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]")
  }
  return result
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return stripSecrets(value)
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeValue(v)])
    )
  }
  return value
}

export function sanitizeKnowledgePack(pack: KnowledgePack): KnowledgePack {
  return sanitizeValue(JSON.parse(JSON.stringify(pack))) as KnowledgePack
}

// ---------------------------------------------------------------------------
// ID generation — deterministic SHA-256 of pack content (excluding id field)
// ---------------------------------------------------------------------------

function sortedStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return "[" + value.map(sortedStringify).join(",") + "]"
  }
  const keys = Object.keys(value as object).sort()
  const pairs = keys.map(
    (k) => JSON.stringify(k) + ":" + sortedStringify((value as Record<string, unknown>)[k])
  )
  return "{" + pairs.join(",") + "}"
}

export function generatePackId(pack: KnowledgePack): string {
  // Exclude the id field so the hash is content-addressable
  const { id: _id, ...rest } = pack
  const canonical = sortedStringify(rest)
  return createHash("sha256").update(canonical).digest("hex")
}
