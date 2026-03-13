import { SkillCategory } from "./knowledge-pack"
import type { DeliveryConfig } from "./knowledge-pack"

// ---------------------------------------------------------------------------
// Template definition — shape for quick-start pack creation
// ---------------------------------------------------------------------------

export interface PackTemplate {
  title: string
  category: SkillCategory
  descriptionHint: string
  delivery: Pick<DeliveryConfig, "estimatedMinutes" | "difficultyLevel" | "format">
  suggestedModules: Array<{
    name: string
    description: string
    difficultyHint: "beginner" | "intermediate" | "advanced"
  }>
  suggestedTags: string[]
  pricingHint: {
    minUSD: number
    maxUSD: number
    recommendedType: "one-time" | "subscription" | "per-session"
  }
}

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

export const PACK_TEMPLATES: Record<string, PackTemplate> = {
  "social-media": {
    title: "Social Media Growth Pack",
    category: SkillCategory.SocialMedia,
    descriptionHint:
      "A comprehensive guide to growing your social media presence through content strategy, engagement optimization, and data-driven iteration.",
    delivery: {
      estimatedMinutes: 30,
      difficultyLevel: "intermediate",
      format: "structured",
    },
    suggestedModules: [
      {
        name: "Content Strategy",
        description:
          "How to plan and produce content that resonates with your target audience — cadence, formats, hooks, and repurposing.",
        difficultyHint: "beginner",
      },
      {
        name: "Engagement Optimization",
        description:
          "Tactics for maximizing replies, reposts, and saves. Includes timing, call-to-action patterns, and community interaction loops.",
        difficultyHint: "intermediate",
      },
      {
        name: "Analytics & Iteration",
        description:
          "Reading your native analytics, identifying top-performing content patterns, and running lightweight A/B tests.",
        difficultyHint: "intermediate",
      },
      {
        name: "Audience Research",
        description:
          "Finding and studying your ideal audience: what problems they have, what language they use, and where they congregate.",
        difficultyHint: "beginner",
      },
      {
        name: "Monetization Paths",
        description:
          "Converting followers into revenue: sponsorships, digital products, affiliate programs, and community memberships.",
        difficultyHint: "advanced",
      },
    ],
    suggestedTags: ["growth", "content", "engagement", "analytics", "social"],
    pricingHint: { minUSD: 15, maxUSD: 60, recommendedType: "one-time" },
  },

  "crypto-analysis": {
    title: "Crypto Market Analysis Pack",
    category: SkillCategory.CryptoIntel,
    descriptionHint:
      "On-chain intelligence and market analysis techniques for navigating crypto markets — from reading order books to tracking whale wallets.",
    delivery: {
      estimatedMinutes: 45,
      difficultyLevel: "advanced",
      format: "structured",
    },
    suggestedModules: [
      {
        name: "On-Chain Fundamentals",
        description:
          "Reading block explorers, interpreting wallet activity, identifying accumulation vs. distribution phases.",
        difficultyHint: "intermediate",
      },
      {
        name: "Technical Analysis Basics",
        description:
          "Key chart patterns, support/resistance levels, volume analysis, and momentum indicators relevant to crypto.",
        difficultyHint: "beginner",
      },
      {
        name: "Whale Tracking",
        description:
          "Tools and methods for following large wallet movements and interpreting what they signal about market sentiment.",
        difficultyHint: "advanced",
      },
      {
        name: "DeFi Protocol Analysis",
        description:
          "Evaluating liquidity pools, yield opportunities, and protocol risk: TVL trends, token emissions, and rug vectors.",
        difficultyHint: "advanced",
      },
      {
        name: "News & Sentiment Integration",
        description:
          "Correlating on-chain signals with off-chain news flow, funding rates, and social sentiment scores.",
        difficultyHint: "intermediate",
      },
    ],
    suggestedTags: ["crypto", "on-chain", "trading", "defi", "analysis", "whale"],
    pricingHint: { minUSD: 25, maxUSD: 100, recommendedType: "one-time" },
  },

  "coding-patterns": {
    title: "Coding Patterns & Best Practices Pack",
    category: SkillCategory.DevOps,
    descriptionHint:
      "Battle-tested software design patterns, refactoring techniques, and code-quality practices drawn from real production experience.",
    delivery: {
      estimatedMinutes: 60,
      difficultyLevel: "intermediate",
      format: "workshop",
    },
    suggestedModules: [
      {
        name: "SOLID Principles in Practice",
        description:
          "Applying Single Responsibility, Open/Closed, Liskov, Interface Segregation, and Dependency Inversion with concrete before/after examples.",
        difficultyHint: "intermediate",
      },
      {
        name: "Common Design Patterns",
        description:
          "Factory, Strategy, Observer, Repository, and Command patterns — when to use them and when to avoid them.",
        difficultyHint: "intermediate",
      },
      {
        name: "Refactoring Techniques",
        description:
          "Safe refactoring steps: extract method, introduce parameter object, replace conditional with polymorphism.",
        difficultyHint: "intermediate",
      },
      {
        name: "Testing Strategies",
        description:
          "Unit vs. integration vs. E2E testing trade-offs, test pyramid, TDD workflow, and writing tests that don't slow you down.",
        difficultyHint: "beginner",
      },
      {
        name: "Performance Optimization",
        description:
          "Profiling first, micro-optimizations last. Caching patterns, database query optimization, and async concurrency.",
        difficultyHint: "advanced",
      },
    ],
    suggestedTags: ["software", "patterns", "refactoring", "clean-code", "typescript", "testing"],
    pricingHint: { minUSD: 20, maxUSD: 80, recommendedType: "one-time" },
  },

  "content-creation": {
    title: "Content Creation Mastery Pack",
    category: SkillCategory.ContentCreation,
    descriptionHint:
      "End-to-end content production workflow: ideation, scripting, production, editing, and distribution across multiple formats.",
    delivery: {
      estimatedMinutes: 40,
      difficultyLevel: "beginner",
      format: "structured",
    },
    suggestedModules: [
      {
        name: "Ideation Systems",
        description:
          "Never run out of ideas: content pillars, audience questions, competitor gap analysis, and trend riding.",
        difficultyHint: "beginner",
      },
      {
        name: "Hook Writing",
        description:
          "Crafting the first 3 seconds/lines that stop the scroll: patterns, formulas, and A/B testing hooks.",
        difficultyHint: "intermediate",
      },
      {
        name: "Scripting & Storytelling",
        description:
          "Story arc frameworks (before/after, problem/solution, transformation) adapted for short-form and long-form content.",
        difficultyHint: "beginner",
      },
      {
        name: "Production Workflow",
        description:
          "Batching content creation, tool stack recommendations, repurposing a single piece across 5+ formats.",
        difficultyHint: "beginner",
      },
      {
        name: "Distribution Strategy",
        description:
          "Platform-specific formatting, optimal posting times, cross-promotion, and building distribution flywheels.",
        difficultyHint: "intermediate",
      },
    ],
    suggestedTags: ["content", "writing", "video", "scripting", "hooks", "production"],
    pricingHint: { minUSD: 10, maxUSD: 50, recommendedType: "one-time" },
  },

  "devops-automation": {
    title: "DevOps Automation Pack",
    category: SkillCategory.DevOps,
    descriptionHint:
      "Practical CI/CD, infrastructure-as-code, and automation patterns for shipping software faster and more reliably.",
    delivery: {
      estimatedMinutes: 50,
      difficultyLevel: "intermediate",
      format: "workshop",
    },
    suggestedModules: [
      {
        name: "CI/CD Pipeline Design",
        description:
          "Building fast, reliable pipelines: parallelism, caching, test splitting, deployment gates, and rollback strategies.",
        difficultyHint: "intermediate",
      },
      {
        name: "Infrastructure as Code",
        description:
          "Terraform/Pulumi patterns for reproducible environments: modules, state management, and drift detection.",
        difficultyHint: "intermediate",
      },
      {
        name: "Container Orchestration",
        description:
          "Docker best practices, Kubernetes deployment patterns, health checks, resource limits, and zero-downtime deploys.",
        difficultyHint: "advanced",
      },
      {
        name: "Observability & Alerting",
        description:
          "Structured logging, distributed tracing, metrics dashboards, and on-call runbook patterns.",
        difficultyHint: "intermediate",
      },
      {
        name: "Secret & Config Management",
        description:
          "Vault, environment variable hygiene, secret rotation, and 12-factor app configuration practices.",
        difficultyHint: "intermediate",
      },
    ],
    suggestedTags: ["devops", "cicd", "kubernetes", "terraform", "automation", "infrastructure"],
    pricingHint: { minUSD: 20, maxUSD: 90, recommendedType: "one-time" },
  },

  "trading-strategies": {
    title: "Trading Strategies Pack",
    category: SkillCategory.Trading,
    descriptionHint:
      "Systematic trading approaches: strategy development, backtesting, risk management, and live execution frameworks.",
    delivery: {
      estimatedMinutes: 55,
      difficultyLevel: "advanced",
      format: "structured",
    },
    suggestedModules: [
      {
        name: "Strategy Development Framework",
        description:
          "Building a hypothesis-driven trading strategy: edge identification, entry/exit logic, and position sizing.",
        difficultyHint: "intermediate",
      },
      {
        name: "Backtesting & Validation",
        description:
          "Avoiding curve-fitting, walk-forward optimization, out-of-sample testing, and interpreting Sharpe/Sortino ratios.",
        difficultyHint: "advanced",
      },
      {
        name: "Risk Management",
        description:
          "Position sizing models (Kelly, fixed fractional), drawdown limits, correlation-aware portfolio management.",
        difficultyHint: "advanced",
      },
      {
        name: "Order Execution",
        description:
          "Market vs. limit orders, slippage minimization, execution algorithms, and exchange API integration patterns.",
        difficultyHint: "intermediate",
      },
      {
        name: "Psychology & Discipline",
        description:
          "Journaling routines, rule adherence systems, handling drawdowns, and separating strategy performance from trader error.",
        difficultyHint: "beginner",
      },
    ],
    suggestedTags: ["trading", "strategy", "backtesting", "risk", "systematic", "crypto", "finance"],
    pricingHint: { minUSD: 30, maxUSD: 150, recommendedType: "one-time" },
  },
}

// ---------------------------------------------------------------------------
// Helper — list available template keys
// ---------------------------------------------------------------------------

export function listTemplateKeys(): string[] {
  return Object.keys(PACK_TEMPLATES)
}

export function getTemplate(key: string): PackTemplate | undefined {
  return PACK_TEMPLATES[key]
}
