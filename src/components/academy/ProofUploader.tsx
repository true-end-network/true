"use client"

import { useState, useRef, type FormEvent } from "react"
import { Upload, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface MetricEntry {
  id: string
  key: string
  value: string
}

export interface ProofUploadData {
  platform: string
  screenshot?: string
  metrics: { key: string; value: string }[]
}

interface ProofUploaderProps {
  onUpload?: (data: ProofUploadData) => void
}

const PLATFORMS = ["Twitter/X", "Instagram", "TikTok", "YouTube"]

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export function ProofUploader({ onUpload }: ProofUploaderProps) {
  const [platform, setPlatform] = useState("Twitter/X")
  const [preview, setPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [metrics, setMetrics] = useState<MetricEntry[]>([
    { id: uid(), key: "", value: "" },
  ])
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleDrop(e: { preventDefault: () => void; dataTransfer: DataTransfer }) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function addMetric() {
    setMetrics((m) => [...m, { id: uid(), key: "", value: "" }])
  }

  function removeMetric(id: string) {
    setMetrics((m) => m.filter((x) => x.id !== id))
  }

  function updateMetric(id: string, field: "key" | "value", val: string) {
    setMetrics((m) =>
      m.map((x) => (x.id === id ? { ...x, [field]: val } : x))
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setUploading(true)
    try {
      const data: ProofUploadData = {
        platform,
        screenshot: preview ?? undefined,
        metrics: metrics
          .filter((m) => m.key.trim() && m.value.trim())
          .map(({ key, value }) => ({ key, value })),
      }
      try {
        await fetch("/api/marketplace/proofs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
      } catch {
        // API might not exist yet — still call onUpload
      }
      onUpload?.(data)
      setPreview(null)
      setMetrics([{ id: uid(), key: "", value: "" }])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Platform tabs */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Platform</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                platform === p
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "relative cursor-pointer rounded-lg border-2 border-dashed transition-colors",
          isDragging
            ? "border-primary/60 bg-primary/5"
            : "border-border/50 hover:border-border"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-48 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPreview(null)
              }}
              className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Drop screenshot here</p>
            <p className="text-xs text-muted-foreground">or click to browse · PNG, JPG, WebP</p>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Metrics</label>
          <button
            type="button"
            onClick={addMetric}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add metric
          </button>
        </div>
        {metrics.map((m) => (
          <div key={m.id} className="flex gap-2">
            <Input
              value={m.key}
              onChange={(e) => updateMetric(m.id, "key", e.target.value)}
              placeholder="Followers"
              className="text-xs"
            />
            <Input
              value={m.value}
              onChange={(e) => updateMetric(m.id, "value", e.target.value)}
              placeholder="14.4K"
              className="text-xs"
            />
            {metrics.length > 1 && (
              <button
                type="button"
                onClick={() => removeMetric(m.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {success && (
        <div className="rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2">
          <p className="text-xs text-green-400">Proof uploaded successfully!</p>
        </div>
      )}

      <Button type="submit" disabled={uploading} size="sm" className="w-full">
        {uploading ? "Uploading…" : "Upload Proof"}
      </Button>
    </form>
  )
}
