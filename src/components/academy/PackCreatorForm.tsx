"use client"

import { useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { type Category } from "./CategoryBadge"

const CATEGORIES: Category[] = [
  "Social Media",
  "Crypto Intel",
  "Sales",
  "Content Creation",
  "DevOps",
  "Analytics",
  "Productivity",
  "DeFi",
  "Trading",
]

interface SkillEntry {
  id: string
  name: string
  description: string
}

interface MetricEntry {
  id: string
  key: string
  value: string
}

interface ModuleEntry {
  id: string
  title: string
  content: string
}

interface FormState {
  title: string
  description: string
  category: Category
  skills: SkillEntry[]
  modules: ModuleEntry[]
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
  modules: [{ id: "1", title: "", content: "" }],
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

interface PackCreatorFormProps {
  onSuccess?: () => void
}

export function PackCreatorForm({ onSuccess }: PackCreatorFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addSkill() {
    setField("skills", [...form.skills, { id: uid(), name: "", description: "" }])
  }
  function removeSkill(id: string) {
    setField("skills", form.skills.filter((s) => s.id !== id))
  }
  function updateSkill(id: string, field: "name" | "description", val: string) {
    setField(
      "skills",
      form.skills.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    )
  }

  function addModule() {
    setField("modules", [...form.modules, { id: uid(), title: "", content: "" }])
  }
  function removeModule(id: string) {
    setField("modules", form.modules.filter((m) => m.id !== id))
  }
  function updateModule(id: string, field: "title" | "content", val: string) {
    setField(
      "modules",
      form.modules.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    )
  }

  function addMetric() {
    setField("metrics", [...form.metrics, { id: uid(), key: "", value: "" }])
  }
  function removeMetric(id: string) {
    setField("metrics", form.metrics.filter((m) => m.id !== id))
  }
  function updateMetric(id: string, field: "key" | "value", val: string) {
    setField(
      "metrics",
      form.metrics.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim() || !form.price) {
      setError("Please fill in Title, Description, and Price")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        price: parseFloat(form.price),
        currency: form.currency,
        skills: form.skills
          .filter((s) => s.name.trim())
          .map(({ name, description }) => ({ name, description })),
        modules: form.modules
          .filter((m) => m.title.trim())
          .map(({ title, content }) => ({ title, content })),
        metrics: form.metrics
          .filter((m) => m.key.trim() && m.value.trim())
          .map(({ key, value }) => ({ key, value })),
        mentor: {
          name: form.mentorName,
          platform: form.platform,
          specialties: form.specialties
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
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
      onSuccess?.()
    } catch {
      setError("Failed to create pack. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Separator />

      {/* Skills */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Skills to Transfer</label>
          <button
            type="button"
            onClick={addSkill}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
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
              />
              <Input
                value={skill.description}
                onChange={(e) => updateSkill(skill.id, "description", e.target.value)}
                placeholder="Brief description (optional)"
                className="text-xs"
              />
            </div>
            {form.skills.length > 1 && (
              <button
                type="button"
                onClick={() => removeSkill(skill.id)}
                className="shrink-0 self-start mt-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Separator />

      {/* Modules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Modules</label>
          <button
            type="button"
            onClick={addModule}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add module
          </button>
        </div>
        {form.modules.map((mod, i) => (
          <div key={mod.id} className="rounded-md border border-border/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={mod.title}
                onChange={(e) => updateModule(mod.id, "title", e.target.value)}
                placeholder={`Module ${i + 1} title`}
                className="flex-1"
              />
              {form.modules.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeModule(mod.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <textarea
              value={mod.content}
              onChange={(e) => updateModule(mod.id, "content", e.target.value)}
              placeholder="Module content, topics covered, key takeaways…"
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
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
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Separator />

      {/* Proof metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Proof Metrics</label>
          <button
            type="button"
            onClick={addMetric}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add metric
          </button>
        </div>
        {form.metrics.map((metric) => (
          <div key={metric.id} className="flex gap-2">
            <Input
              value={metric.key}
              onChange={(e) => updateMetric(metric.id, "key", e.target.value)}
              placeholder="Key (e.g., followers)"
              className="flex-1"
            />
            <Input
              value={metric.value}
              onChange={(e) => updateMetric(metric.id, "value", e.target.value)}
              placeholder="Value (e.g., 14.4K)"
              className="flex-1"
            />
            {form.metrics.length > 1 && (
              <button
                type="button"
                onClick={() => removeMetric(metric.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              >
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
            <Input
              value={form.mentorName}
              onChange={(e) => setField("mentorName", e.target.value)}
              placeholder="AgentX-7"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">Platform</label>
            <Input
              value={form.platform}
              onChange={(e) => setField("platform", e.target.value)}
              placeholder="Twitter/X"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground">
            Specialties (comma-separated)
          </label>
          <Input
            value={form.specialties}
            onChange={(e) => setField("specialties", e.target.value)}
            placeholder="Growth hacking, Hook writing, Thread architecture"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">Experience summary</label>
            <Input
              value={form.experience}
              onChange={(e) => setField("experience", e.target.value)}
              placeholder="3 years building audiences"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">Key results</label>
            <Input
              value={form.results}
              onChange={(e) => setField("results", e.target.value)}
              placeholder="14.4K followers, 3.2% engagement"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {success && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
          <p className="text-xs text-green-400">Pack listed successfully!</p>
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Listing pack…" : "List Knowledge Pack"}
      </Button>
    </form>
  )
}
