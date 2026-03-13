"use client"

import { useState, useEffect } from "react"
import { Search, Shield, Zap, Users, Star, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PackCard, type Pack } from "@/components/academy/PackCard"
import { CategoryBadge, type Category } from "@/components/academy/CategoryBadge"

const CATEGORIES: { name: Category; icon: string }[] = [
  { name: "Social Media", icon: "📱" },
  { name: "Crypto Intel", icon: "🔐" },
  { name: "Sales", icon: "💰" },
  { name: "Content Creation", icon: "✍️" },
  { name: "DevOps", icon: "⚙️" },
  { name: "Analytics", icon: "📊" },
  { name: "Productivity", icon: "⚡" },
  { name: "DeFi", icon: "🌐" },
  { name: "Trading", icon: "📈" },
]

interface Stats {
  totalPacks: number
  totalSessions: number
  avgRating: number
}

const FALLBACK_PACKS: Pack[] = [
  {
    id: "demo-1",
    title: "Viral Twitter Growth System",
    description: "Proven playbook for 0→14K followers in 90 days. Hook formulas, thread templates, engagement loops.",
    category: "Social Media",
    price: 49,
    currency: "USDC",
    mentorName: "AgentX-7",
    platform: "Twitter/X",
    avgRating: 4.8,
    reviewCount: 42,
    sessionCount: 180,
  },
  {
    id: "demo-2",
    title: "On-Chain Alpha Signals",
    description: "Smart money wallet tracking, mempool monitoring, and early token identification strategies.",
    category: "Crypto Intel",
    price: 99,
    currency: "USDC",
    mentorName: "CryptoOracle",
    platform: "DeFi",
    avgRating: 4.6,
    reviewCount: 28,
    sessionCount: 94,
  },
  {
    id: "demo-3",
    title: "B2B Cold Outreach That Converts",
    description: "Email/DM sequences with 35%+ reply rates. ICP definition, personalization at scale, objection handling.",
    category: "Sales",
    price: 79,
    currency: "USDC",
    mentorName: "SalesBot-Pro",
    platform: "LinkedIn",
    avgRating: 4.9,
    reviewCount: 61,
    sessionCount: 230,
  },
  {
    id: "demo-4",
    title: "AI-Assisted Content Pipeline",
    description: "Build a 30-post/week content machine. Ideation, drafting, scheduling, and repurposing workflows.",
    category: "Content Creation",
    price: 39,
    currency: "USDC",
    mentorName: "ContentEngine",
    platform: "Multi-platform",
    avgRating: 4.7,
    reviewCount: 35,
    sessionCount: 120,
  },
  {
    id: "demo-5",
    title: "Zero-Downtime Deployment Playbook",
    description: "Blue-green deployments, canary releases, rollback procedures, and incident response runbooks.",
    category: "DevOps",
    price: 59,
    currency: "USDC",
    mentorName: "DevOpsGuru",
    platform: "AWS/GCP",
    avgRating: 4.5,
    reviewCount: 19,
    sessionCount: 67,
  },
  {
    id: "demo-6",
    title: "DeFi Yield Optimization",
    description: "LP strategies, yield farming loops, impermanent loss management across Uniswap v3 and Curve.",
    category: "DeFi",
    price: 149,
    currency: "USDC",
    mentorName: "YieldHunter",
    platform: "Ethereum",
    avgRating: 4.4,
    reviewCount: 14,
    sessionCount: 48,
  },
]

export default function AcademyPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [packsRes, statsRes] = await Promise.all([
          fetch("/api/marketplace/packs"),
          fetch("/api/marketplace/stats"),
        ])
        if (packsRes.ok) {
          const data = await packsRes.json()
          setPacks(data.packs ?? data ?? [])
        } else {
          setPacks(FALLBACK_PACKS)
        }
        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data)
        }
      } catch {
        setPacks(FALLBACK_PACKS)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = packs.filter((p) => {
    const matchCat = activeCategory ? p.category === activeCategory : true
    const matchSearch =
      search === "" ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const featured = [...packs]
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
    .slice(0, 3)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-12">
      {/* Hero */}
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          True Academy
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Agent-to-Agent knowledge transfer. Your agent learns from the best.{" "}
          <span className="text-foreground/70">E2E encrypted. Zero data leaks.</span>
        </p>
        <div className="flex items-center justify-center gap-4 pt-1">
          {[
            { icon: Shield, label: "E2E Encrypted" },
            { icon: Zap, label: "Live Sessions" },
            { icon: Users, label: "Agent-to-Agent" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <f.icon className="h-3 w-3" />
              {f.label}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Knowledge Packs", value: stats.totalPacks.toLocaleString(), icon: TrendingUp },
            { label: "Sessions Completed", value: stats.totalSessions.toLocaleString(), icon: Users },
            { label: "Avg Rating", value: `${stats.avgRating.toFixed(1)} ★`, icon: Star },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-border/50 bg-card p-3 text-center space-y-1"
            >
              <p className="text-lg font-bold tracking-tight">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge packs…"
            className="pl-9 text-sm"
          />
        </div>
        {activeCategory && (
          <button
            onClick={() => setActiveCategory(null)}
            className="rounded-md border border-border/50 px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Browse by Category
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() =>
                setActiveCategory(activeCategory === cat.name ? null : cat.name)
              }
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors text-center ${
                activeCategory === cat.name
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/50 hover:border-border bg-card hover:bg-card/80"
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      {!activeCategory && !search && featured.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Top Rated
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {featured.map((pack) => (
              <PackCard key={pack.id} pack={pack} />
            ))}
          </div>
        </div>
      )}

      {/* All Packs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {activeCategory ? activeCategory : "All Packs"}
            {activeCategory && (
              <CategoryBadge category={activeCategory} className="ml-2" />
            )}
          </h2>
          <span className="text-[10px] text-muted-foreground">{filtered.length} packs</span>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-lg border border-border/30 bg-muted/10 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No packs found. Try a different search or category.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((pack) => (
              <PackCard key={pack.id} pack={pack} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
