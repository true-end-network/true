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
// V2 — new sub-interfaces
// ---------------------------------------------------------------------------

export interface PlatformPresence {
  platform: "x" | "instagram" | "tiktok" | "youtube" | "github" | "discord"
  handle: string
  followers?: number
  verified: boolean
  proofType: "api" | "screenshot" | "self_reported"
}

export interface Testimonial {
  agentName: string
  rating: number          // 1–5
  comment: string
  date: string
  verified: boolean
}

export interface DeliveryConfig {
  estimatedMinutes: number
  prerequisites: string[]
  difficultyLevel: "beginner" | "intermediate" | "advanced" | "expert"
  format: "structured" | "interactive" | "workshop"
  maxMenteesPerSession: number            // 1 for 1-on-1, more for group
}

export interface VerificationSection {
  mentorPlatforms: PlatformPresence[]
  totalExperience: string                 // e.g. "6 months operating @0xCVYH"
  proofSummary: string                    // one-line credibility summary
}

export interface PreviewContent {
  sampleSkill?: SkillEntry                // one skill shown for free
  testimonials: Testimonial[]
  demoVideo?: string                      // URL to demo/explainer video
}

export interface CompatibilitySpec {
  platforms: ("openclaw" | "claude" | "chatgpt" | "custom")[]
  minSdkVersion: string
  requiredTools?: string[]                // tools the mentee needs
}

// ---------------------------------------------------------------------------
// Root interface
// ---------------------------------------------------------------------------

export interface KnowledgePack {
  id: string                              // SHA-256 hash
  version: string                         // semver; use "2.0" for v2 packs
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

  // V2 — optional for backward compatibility with v1 packs
  delivery?: DeliveryConfig
  verification?: VerificationSection
  preview?: PreviewContent
  compatibility?: CompatibilitySpec
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"])
const VALID_DELIVERY_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced", "expert"])
const VALID_PRICING_TYPES = new Set(["one-time", "subscription", "per-session"])
const VALID_CURRENCIES = new Set(["USD", "USDT", "ETH", "SOL", "BRL"])
const VALID_CATEGORIES = new Set(Object.values(SkillCategory))
const VALID_PLATFORM_PRESENCE = new Set(["x", "instagram", "tiktok", "youtube", "github", "discord"])
const VALID_PROOF_TYPES = new Set(["api", "screenshot", "self_reported"])
const VALID_DELIVERY_FORMATS = new Set(["structured", "interactive", "workshop"])
const VALID_COMPAT_PLATFORMS = new Set(["openclaw", "claude", "chatgpt", "custom"])

function isString(v: unknown): v is string {
  return typeof v === "string"
}
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function validatePlatformPresence(p: unknown): boolean {
  if (!isObject(p)) return false
  if (!VALID_PLATFORM_PRESENCE.has(p.platform as string)) return false
  if (!isString(p.handle) || !p.handle) return false
  if (p.followers !== undefined && typeof p.followers !== "number") return false
  if (typeof p.verified !== "boolean") return false
  if (!VALID_PROOF_TYPES.has(p.proofType as string)) return false
  return true
}

function validateTestimonial(t: unknown): boolean {
  if (!isObject(t)) return false
  if (!isString(t.agentName) || !t.agentName) return false
  if (typeof t.rating !== "number" || (t.rating as number) < 1 || (t.rating as number) > 5) return false
  if (!isString(t.comment)) return false
  if (!isString(t.date)) return false
  if (typeof t.verified !== "boolean") return false
  return true
}

function validateV2Fields(pack: Record<string, unknown>): boolean {
  // delivery
  if (pack.delivery !== undefined) {
    if (!isObject(pack.delivery)) return false
    const d = pack.delivery
    if (typeof d.estimatedMinutes !== "number" || (d.estimatedMinutes as number) <= 0) return false
    if (!Array.isArray(d.prerequisites)) return false
    if (!VALID_DELIVERY_DIFFICULTIES.has(d.difficultyLevel as string)) return false
    if (!VALID_DELIVERY_FORMATS.has(d.format as string)) return false
    if (typeof d.maxMenteesPerSession !== "number" || (d.maxMenteesPerSession as number) < 1) return false
  }

  // verification
  if (pack.verification !== undefined) {
    if (!isObject(pack.verification)) return false
    const v = pack.verification
    if (!Array.isArray(v.mentorPlatforms)) return false
    for (const p of v.mentorPlatforms as unknown[]) {
      if (!validatePlatformPresence(p)) return false
    }
    if (!isString(v.totalExperience)) return false
    if (!isString(v.proofSummary)) return false
  }

  // preview
  if (pack.preview !== undefined) {
    if (!isObject(pack.preview)) return false
    const pr = pack.preview
    if (pr.sampleSkill !== undefined) {
      if (!isObject(pr.sampleSkill)) return false
      const s = pr.sampleSkill
      if (!isString(s.name) || !isString(s.category) || !isString(s.content)) return false
      if (!VALID_DIFFICULTIES.has(s.difficulty as string)) return false
      if (!Array.isArray(s.examples) || !Array.isArray(s.pitfalls)) return false
    }
    if (!Array.isArray(pr.testimonials)) return false
    for (const t of pr.testimonials as unknown[]) {
      if (!validateTestimonial(t)) return false
    }
    if (pr.demoVideo !== undefined && !isString(pr.demoVideo)) return false
  }

  // compatibility
  if (pack.compatibility !== undefined) {
    if (!isObject(pack.compatibility)) return false
    const c = pack.compatibility
    if (!Array.isArray(c.platforms)) return false
    for (const p of c.platforms as unknown[]) {
      if (!VALID_COMPAT_PLATFORMS.has(p as string)) return false
    }
    if (!isString(c.minSdkVersion)) return false
    if (c.requiredTools !== undefined && !Array.isArray(c.requiredTools)) return false
  }

  return true
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

  // V2 fields — optional but validated when present
  if (!validateV2Fields(pack)) return false

  return true
}

// ---------------------------------------------------------------------------
// Sanitization — strip potential secrets and sensitive data from all string fields
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
  // Internal/private URLs (localhost, 10.x, 172.16-31.x, 192.168.x, 127.x, *.internal, *.local)
  /https?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(?::\d+)?[^\s]*/g,
  /https?:\/\/[^\s]*\.(?:internal|local|intranet|corp|lan)(?::\d+)?[^\s]*/gi,
  // Unix/Windows file paths (absolute)
  /(?:^|\s)(?:\/(?:etc|var|home|root|usr|tmp|opt|srv|proc|sys|dev)\/[^\s,;'"]+)/g,
  /[A-Za-z]:\\[^\s,;'"]+/g,
  // IPv4 addresses (not in public-safe ranges — catches any bare IP)
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // Email addresses
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  // Private/internal endpoint patterns (e.g. api.internal-name.com/v1/private)
  /https?:\/\/[^\s]*(?:private|internal|admin|staging|dev\.|localhost)[^\s]*/gi,
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
