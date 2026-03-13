"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Bot, Star, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { CategoryBadge } from "@/components/academy/CategoryBadge"
import { StarRating } from "@/components/academy/StarRating"
import { type Category } from "@/components/academy/CategoryBadge"

const CATEGORIES: Category[] = [
  "Social Media", "Crypto Intel", "Sales", "Content Creation",
  "DevOps", "Analytics", "Productivity", "DeFi", "Trading",
]

interface SkillEntry { id: string; name: string; description: string }
interface MetricEntry { id: string; key: string; value: string }

interface ListedPack {
  id: string
  title: string
  category: string
  price: number
  currency: string
  sessionCount: number
  avgRating?: number
  reviewCount?: number
}

interface FormState {
  title: string
  description: string
  category: Category
  skills: SkillEntry[]
  price: string
  currency: string
  metrics: MetricEntry[]
  mentorName: string
  platform: string
  specialties: string
  experience: string
  results: string
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "Social Media",
  skills: [{ id: "1", name: "", description: "" }],
  price: "",
  currency: "USDC",
  metrics: [{ id: "1", key: "", value: "" }],
  mentorName: "",
  platform: "",
  specialties: "",
  experience: "",
  results: "",
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export default function MentorPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [success, setSuccess] = useState(false)
  const [myPacks, setMyPacks] = useState<ListedPack[]>([])
  const [loadingPacks, setLoadingPacks] = useState(true)

  useEffect(() => {
    async function loadPacks() {
      try {
        const res = await fetch("/api/marketplace/packs?mine=true")
        if (res.ok) {
          const data = await res.json()
          setMyPacks(data.packs ?? data ?? [])
        }
      } catch {
        // no packs loaded, that's ok
      } finally {
        setLoadingPacks(false)
      }
    }
    loadPacks()
  }, [success])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addSkill() {
    setField("skills", [...form.skills, { id: uid(), name: "", description: "" }])
  }

  function removeSkill(id: string) {
    setField("skills", form.skills.filter((s) => s.id !== id))
  }

  function updateSkill(id: string, field: "name" | "description", value: string) {
    setField(
      "skills",
      form.skills.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }

  function addMetric() {
    setField("metrics", [...form.metrics, { id: uid(), key: "", value: "" }])
  }

  function removeMetric(id: string) {
    setField("metrics", form.metrics.filter((m) => m.id !== id))
  }

  function updateMetric(id: string, field: "key" | "value", value: string) {
    setField(
      "metrics",
      form.metrics.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    )
  }

  async function handleDelete(packId: string) {
    try {
      await fetch(`/api/marketplace/packs/${packId}`, { method: "DELETE" })
      setMyPacks((p) => p.filter((pack) => pack.id !== packId))
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim() || !form.price) {
      setSubmitError("Please fill in all required fields")
      return
    }
    setSubmitting(true)
    setSubmitError("")
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        price: parseFloat(form.price),
        currency: form.currency,
        skills: form.skills.filter((s) => s.name.trim()).map(({ name, description }) => ({ name, description })),
        metrics: form.metrics.filter((m) => m.key.trim() && m.value.trim()).map(({ key, value }) => ({ key, value })),
        mentor: {
          name: form.mentorName,
          platform: form.platform,
          specialties: form.specialties.split(",").map((s) => s.trim()).filter(Boolean),
          experience: form.experience,
          results: form.results,
        },
      }
      const res = await fetch("/api/marketplace/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to create pack")
      setForm(EMPTY_FORM)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setSubmitError("Failed to create pack. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-10">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Mentor Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          List your agent&apos;s knowledge and earn from live E2E encrypted sessions.
        </p>
      </div>

      {/* Create form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">New Knowledge Pack</h2>
          <p className="text-xs text-muted-foreground">Fields marked * are required</p>
        </div>

        {/* Basic info */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Title *</label>
            <Input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g., Viral Twitter Growth System"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Describe what knowledge your agent will transfer…"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Category *</label>
            <select
              value={form.category}
              onChange={(e) => setField("category", e.target.value as Category)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <Separator />

        {/* Skills */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Skills to Transfer</label>
            <button type="button" onClick={addSkill} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add skill
            </button>
          </div>
          {form.skills.map((skill, i) => (
            <div key={skill.id} className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Input
                  value={skill.name}
                  onChange={(e) => updateSkill(skill.id, "name", e.target.value)}
                  placeholder={`Skill ${i + 1} name`}
                  className="text-sm"
                />
                <Input
                  value={skill.description}
                  onChange={(e) => updateSkill(skill.id, "description", e.target.value)}
                  placeholder="Brief description (optional)"
                  className="text-xs"
                />
              </div>
              {form.skills.length > 1 && (
                <button type="button" onClick={() => removeSkill(skill.id)} className="shrink-0 self-start mt-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* Pricing */}
        <div className="space-y-3">
          <label className="text-xs font-medium">Pricing *</label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              placeholder="49"
              min="0"
              step="0.01"
              className="flex-1"
            />
            <select
              value={form.currency}
              onChange={(e) => setField("currency", e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {["USDC", "USDT", "ETH", "SOL"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <Separator />

        {/* Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Proof Metrics</label>
            <button type="button" onClick={addMetric} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add metric
            </button>
          </div>
          {form.metrics.map((metric) => (
            <div key={metric.id} className="flex gap-2">
              <Input
                value={metric.key}
                onChange={(e) => updateMetric(metric.id, "key", e.target.value)}
                placeholder="Key (e.g., followers)"
                className="flex-1 text-sm"
              />
              <Input
                value={metric.value}
                onChange={(e) => updateMetric(metric.id, "value", e.target.value)}
                placeholder="Value (e.g., 14.4K)"
                className="flex-1 text-sm"
              />
              {form.metrics.length > 1 && (
                <button type="button" onClick={() => removeMetric(metric.id)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* Mentor profile */}
        <div className="space-y-3">
          <label className="text-xs font-medium">Mentor Profile</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground">Agent name</label>
              <Input value={form.mentorName} onChange={(e) => setField("mentorName", e.target.value)} placeholder="AgentX-7" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground">Platform</label>
              <Input value={form.platform} onChange={(e) => setField("platform", e.target.value)} placeholder="Twitter/X" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">Specialties (comma-separated)</label>
            <Input value={form.specialties} onChange={(e) => setField("specialties", e.target.value)} placeholder="Growth hacking, Hook writing, Thread architecture" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">Experience summary</label>
            <Input value={form.experience} onChange={(e) => setField("experience", e.target.value)} placeholder="3 years building Twitter audiences for SaaS founders" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">Key results</label>
            <Input value={form.results} onChange={(e) => setField("results", e.target.value)} placeholder="14.4K followers, 3.2% avg engagement" />
          </div>
        </div>

        {submitError && <p className="text-xs text-destructive">{submitError}</p>}

        {success && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
            <p className="text-xs text-green-400">Pack listed successfully!</p>
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Listing pack…" : "List Knowledge Pack"}
        </Button>
      </form>

      <Separator />

      {/* My packs */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">My Listed Packs</h2>

        {loadingPacks ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg border border-border/30 bg-muted/10 animate-pulse" />
            ))}
          </div>
        ) : myPacks.length === 0 ? (
          <div className="rounded-lg border border-border/30 py-10 text-center">
            <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No packs listed yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myPacks.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{pack.title}</p>
                    <CategoryBadge category={pack.category} />
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground font-mono">
                      ${pack.price} {pack.currency}
                    </span>
                    {pack.avgRating !== undefined && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-[10px] text-muted-foreground">
                          {pack.avgRating.toFixed(1)} ({pack.reviewCount})
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{pack.sessionCount}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(pack.id)}
                    className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
