import type { KnowledgePack, SkillEntry } from "./knowledge-pack"
import { SkillCategory } from "./knowledge-pack"
import { validateKnowledgePack } from "./knowledge-pack"

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ValidationSeverity = "error" | "warning" | "info"

export interface ValidationIssue {
  code: string
  severity: ValidationSeverity
  message: string
  field?: string
}

export interface ValidationResult {
  valid: boolean
  schemaValid: boolean
  completenessScore: number   // 0–100
  qualityScore: number        // 0–100
  issues: ValidationIssue[]
  suggestions: string[]
}

// ---------------------------------------------------------------------------
// Pricing sanity ranges per category (USD)
// ---------------------------------------------------------------------------

const PRICE_RANGES: Record<SkillCategory, { min: number; max: number }> = {
  [SkillCategory.SocialMedia]:     { min: 5,  max: 100  },
  [SkillCategory.CryptoIntel]:     { min: 10, max: 200  },
  [SkillCategory.Sales]:           { min: 10, max: 150  },
  [SkillCategory.ContentCreation]: { min: 5,  max: 80   },
  [SkillCategory.DevOps]:          { min: 10, max: 150  },
  [SkillCategory.Analytics]:       { min: 10, max: 120  },
  [SkillCategory.Productivity]:    { min: 5,  max: 60   },
  [SkillCategory.SmartHome]:       { min: 5,  max: 50   },
  [SkillCategory.DeFi]:            { min: 15, max: 250  },
  [SkillCategory.Trading]:         { min: 20, max: 300  },
}

// ---------------------------------------------------------------------------
// Known boilerplate phrases used for plagiarism heuristic
// ---------------------------------------------------------------------------

const BOILERPLATE_PHRASES: string[] = [
  "lorem ipsum",
  "placeholder text",
  "insert description here",
  "todo: fill in",
  "coming soon",
  "tbd",
  "your description here",
  "add content here",
  "example skill content",
  "sample workflow",
  "this is a template",
  "replace this text",
  "[skill content]",
  "[description]",
  "[add steps here]",
]

// ---------------------------------------------------------------------------
// Completeness weights (field → weight out of 100)
// ---------------------------------------------------------------------------

const COMPLETENESS_WEIGHTS = {
  hasMinSkills: 10,         // at least 3 skills
  hasErrorLog: 5,           // at least 1 error log entry
  hasWorkflows: 8,          // at least 1 workflow
  hasToolConfigs: 5,
  hasTemplates: 5,
  hasMetrics: 8,
  metricsVerifiable: 5,
  hasTags: 5,
  tagsCount: 5,             // 3+ tags
  hasTargetAudience: 5,
  hasPrerequisites: 3,      // metadata prerequisites
  // V2 fields
  hasDelivery: 10,
  hasVerification: 8,
  hasPreview: 5,
  hasTestimonials: 5,
  hasCompatibility: 5,
  hasDemoVideo: 3,
} as const

// ---------------------------------------------------------------------------
// Quality weights
// ---------------------------------------------------------------------------

const MIN_SKILL_CONTENT_WORDS = 50
const MIN_DESCRIPTION_WORDS = 20
const MIN_SKILL_EXAMPLES = 1
const MIN_SKILL_PITFALLS = 1

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function containsBoilerplate(text: string): string | null {
  const lower = text.toLowerCase()
  for (const phrase of BOILERPLATE_PHRASES) {
    if (lower.includes(phrase)) return phrase
  }
  return null
}

function usdEquivalent(amount: number, currency: string): number {
  // Rough conversion rates for sanity check (not real-time)
  const rates: Record<string, number> = {
    USD: 1,
    USDT: 1,
    ETH: 3000,
    SOL: 150,
    BRL: 0.2,
  }
  return amount * (rates[currency] ?? 1)
}

function issue(
  code: string,
  severity: ValidationSeverity,
  message: string,
  field?: string
): ValidationIssue {
  return { code, severity, message, field }
}

// ---------------------------------------------------------------------------
// Main enhanced validator
// ---------------------------------------------------------------------------

export function validatePackV2(pack: unknown): ValidationResult {
  const issues: ValidationIssue[] = []
  const suggestions: string[] = []

  // 1. Schema validation (base)
  const schemaValid = validateKnowledgePack(pack)
  if (!schemaValid) {
    return {
      valid: false,
      schemaValid: false,
      completenessScore: 0,
      qualityScore: 0,
      issues: [issue("SCHEMA_INVALID", "error", "Pack does not conform to the KnowledgePack schema.")],
      suggestions: ["Fix schema errors before proceeding with quality checks."],
    }
  }

  const p = pack as KnowledgePack

  // 2. Content quality checks
  // Description length
  const descWords = wordCount(p.description)
  if (descWords < MIN_DESCRIPTION_WORDS) {
    issues.push(
      issue(
        "DESC_TOO_SHORT",
        "warning",
        `Description has ${descWords} words; recommend at least ${MIN_DESCRIPTION_WORDS}.`,
        "description"
      )
    )
  }

  // Skills content + examples + pitfalls
  let lowContentSkills = 0
  let missingExamples = 0
  let missingPitfalls = 0
  let boilerplateCount = 0

  for (const skill of p.skills) {
    const words = wordCount(skill.content)
    if (words < MIN_SKILL_CONTENT_WORDS) lowContentSkills++
    if (skill.examples.length < MIN_SKILL_EXAMPLES) missingExamples++
    if (skill.pitfalls.length < MIN_SKILL_PITFALLS) missingPitfalls++

    const bp = containsBoilerplate(skill.content) ?? containsBoilerplate(skill.name)
    if (bp) boilerplateCount++
  }

  if (lowContentSkills > 0) {
    issues.push(
      issue(
        "SKILL_CONTENT_THIN",
        "warning",
        `${lowContentSkills} skill(s) have fewer than ${MIN_SKILL_CONTENT_WORDS} words in their content field.`,
        "skills"
      )
    )
  }
  if (missingExamples > 0) {
    issues.push(
      issue(
        "SKILL_NO_EXAMPLES",
        "warning",
        `${missingExamples} skill(s) are missing examples.`,
        "skills"
      )
    )
  }
  if (missingPitfalls > 0) {
    issues.push(
      issue(
        "SKILL_NO_PITFALLS",
        "info",
        `${missingPitfalls} skill(s) are missing common pitfalls.`,
        "skills"
      )
    )
  }

  // 3. Plagiarism / boilerplate heuristic
  const descBp = containsBoilerplate(p.description) ?? containsBoilerplate(p.title)
  if (descBp) {
    issues.push(
      issue(
        "BOILERPLATE_DETECTED",
        "warning",
        `Title or description contains boilerplate text: "${descBp}". Replace with original content.`,
        "description"
      )
    )
  }
  if (boilerplateCount > 0) {
    issues.push(
      issue(
        "SKILL_BOILERPLATE",
        "warning",
        `${boilerplateCount} skill(s) appear to contain boilerplate text.`,
        "skills"
      )
    )
  }

  // Check workflows for boilerplate
  for (const wf of p.workflows) {
    const bp = containsBoilerplate(wf.description) ?? containsBoilerplate(wf.name)
    if (bp) {
      issues.push(
        issue(
          "WORKFLOW_BOILERPLATE",
          "warning",
          `Workflow "${wf.name}" contains boilerplate text.`,
          "workflows"
        )
      )
      break
    }
  }

  // 4. Pricing sanity check
  const range = PRICE_RANGES[p.category]
  if (range) {
    const usd = usdEquivalent(p.pricing.amount, p.pricing.currency)
    if (usd < range.min) {
      issues.push(
        issue(
          "PRICE_TOO_LOW",
          "warning",
          `Price (~$${usd.toFixed(0)} USD) is below the typical minimum for ${p.category} packs ($${range.min}). Consider if this reflects the value correctly.`,
          "pricing.amount"
        )
      )
    } else if (usd > range.max) {
      issues.push(
        issue(
          "PRICE_TOO_HIGH",
          "warning",
          `Price (~$${usd.toFixed(0)} USD) exceeds the typical maximum for ${p.category} packs ($${range.max}). Ensure value justifies the premium.`,
          "pricing.amount"
        )
      )
    }
  }

  // 5. Completeness score
  let completeness = 0

  if (p.skills.length >= 3) completeness += COMPLETENESS_WEIGHTS.hasMinSkills
  else if (p.skills.length > 0) completeness += 5

  if (p.errorLog.length >= 1) completeness += COMPLETENESS_WEIGHTS.hasErrorLog
  if (p.workflows.length >= 1) completeness += COMPLETENESS_WEIGHTS.hasWorkflows
  if (p.toolConfigs.length >= 1) completeness += COMPLETENESS_WEIGHTS.hasToolConfigs
  if (p.templates.length >= 1) completeness += COMPLETENESS_WEIGHTS.hasTemplates
  if (p.metrics && Object.keys(p.metrics.metrics).length >= 2) completeness += COMPLETENESS_WEIGHTS.hasMetrics
  if (p.metrics?.verifiable) completeness += COMPLETENESS_WEIGHTS.metricsVerifiable
  if (p.metadata.tags.length > 0) completeness += COMPLETENESS_WEIGHTS.hasTags
  if (p.metadata.tags.length >= 3) completeness += COMPLETENESS_WEIGHTS.tagsCount
  if (p.metadata.targetAudience) completeness += COMPLETENESS_WEIGHTS.hasTargetAudience
  if (p.metadata.prerequisites.length > 0) completeness += COMPLETENESS_WEIGHTS.hasPrerequisites

  // V2 fields
  if (p.delivery) {
    completeness += COMPLETENESS_WEIGHTS.hasDelivery
  } else {
    suggestions.push("Add a `delivery` section (estimatedMinutes, format, difficultyLevel) to improve discoverability.")
  }

  if (p.verification) {
    completeness += COMPLETENESS_WEIGHTS.hasVerification
  } else {
    suggestions.push("Add a `verification` section with platform presence proofs to build buyer trust.")
  }

  if (p.preview) {
    completeness += COMPLETENESS_WEIGHTS.hasPreview
    if (p.preview.testimonials.length > 0) completeness += COMPLETENESS_WEIGHTS.hasTestimonials
    if (p.preview.demoVideo) completeness += COMPLETENESS_WEIGHTS.hasDemoVideo
  } else {
    suggestions.push("Add a `preview` section with a sample skill and testimonials to increase conversions.")
  }

  if (p.compatibility) completeness += COMPLETENESS_WEIGHTS.hasCompatibility

  // 6. Quality score (0–100) based on content richness
  let quality = 0
  const qualityChecks = 5
  let passed = 0

  if (descWords >= MIN_DESCRIPTION_WORDS) passed++
  if (p.skills.length >= 3 && lowContentSkills === 0) passed++
  if (boilerplateCount === 0 && !descBp) passed++
  if (p.errorLog.length >= 1 && p.workflows.length >= 1) passed++
  if (p.metadata.tags.length >= 3 && p.metadata.targetAudience.trim().length > 0) passed++

  quality = Math.round((passed / qualityChecks) * 100)

  // 7. SEO / discoverability suggestions
  if (p.metadata.tags.length < 3) {
    suggestions.push(`Add more tags (currently ${p.metadata.tags.length}; recommend 3–8) to improve search visibility.`)
  }
  if (p.metadata.tags.length > 10) {
    suggestions.push("Trim tags to the 8 most relevant — too many dilutes search ranking.")
  }
  if (wordCount(p.title) < 3) {
    suggestions.push("Make your title more descriptive (at least 3 words) for better discoverability.")
  }
  if (!p.metadata.targetAudience || p.metadata.targetAudience.trim().length < 10) {
    suggestions.push("Describe your target audience in more detail to attract the right mentees.")
  }
  if (p.skills.length === 0) {
    suggestions.push("A pack with no skills is unlikely to attract buyers. Add at least 3 skills.")
  }
  if (p.description.length < 100) {
    suggestions.push("Expand your description — longer descriptions (100+ chars) improve conversion rates.")
  }
  if (!p.pricing.trialAvailable) {
    suggestions.push("Consider enabling a trial to reduce purchase hesitation.")
  }

  // Skill-level SEO
  const skillNames = p.skills.map((s: SkillEntry) => s.name.toLowerCase())
  const titleWords = p.title.toLowerCase().split(/\s+/)
  const titleKeywordsInSkills = titleWords.some((word) =>
    word.length > 3 && skillNames.some((name) => name.includes(word))
  )
  if (!titleKeywordsInSkills && p.skills.length > 0) {
    suggestions.push("Align skill names with keywords from your pack title to improve content coherence.")
  }

  const valid = schemaValid && issues.filter((i) => i.severity === "error").length === 0

  return {
    valid,
    schemaValid,
    completenessScore: Math.min(100, Math.round(completeness)),
    qualityScore: quality,
    issues,
    suggestions,
  }
}

// ---------------------------------------------------------------------------
// Convenience: batch validate
// ---------------------------------------------------------------------------

export interface BatchValidationResult {
  packId: string
  result: ValidationResult
}

export function batchValidatePacks(packs: unknown[]): BatchValidationResult[] {
  return packs.map((pack, index) => {
    const result = validatePackV2(pack)
    const packId =
      result.schemaValid && typeof (pack as Record<string, unknown>).id === "string"
        ? ((pack as Record<string, unknown>).id as string)
        : `pack-${index}`
    return { packId, result }
  })
}
