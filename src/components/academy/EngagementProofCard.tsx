import { type ElementType } from "react"
import { CheckCircle2, Twitter, Instagram, Youtube, Music2, Globe, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EngagementProof {
  id: string
  platform: string
  metrics: { key: string; value: string }[]
  screenshotUrl?: string
  verified: boolean
  uploadedAt?: string
}

const PLATFORM_CONFIG: Record<
  string,
  { icon: ElementType; color: string; label: string; bg: string }
> = {
  twitter: {
    icon: Twitter,
    color: "text-sky-400",
    label: "X / Twitter",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
  "twitter/x": {
    icon: Twitter,
    color: "text-sky-400",
    label: "X / Twitter",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
  instagram: {
    icon: Instagram,
    color: "text-pink-400",
    label: "Instagram",
    bg: "bg-pink-500/10 border-pink-500/20",
  },
  youtube: {
    icon: Youtube,
    color: "text-red-400",
    label: "YouTube",
    bg: "bg-red-500/10 border-red-500/20",
  },
  tiktok: {
    icon: Music2,
    color: "text-purple-400",
    label: "TikTok",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
}

function getPlatformConfig(platform: string) {
  return (
    PLATFORM_CONFIG[platform.toLowerCase()] ?? {
      icon: Globe,
      color: "text-muted-foreground",
      label: platform,
      bg: "bg-muted/20 border-border/50",
    }
  )
}

export function EngagementProofCard({ proof }: { proof: EngagementProof }) {
  const cfg = getPlatformConfig(proof.platform)
  const PlatformIcon = cfg.icon

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1", cfg.bg)}>
          <PlatformIcon className={cn("h-3.5 w-3.5", cfg.color)} />
          <span className="text-xs font-medium">{cfg.label}</span>
        </div>

        {proof.verified ? (
          <div className="flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3 text-green-400" />
            <span className="text-[10px] text-green-400 font-medium">Verified</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5">
            <Clock className="h-3 w-3 text-yellow-400" />
            <span className="text-[10px] text-yellow-400 font-medium">Pending</span>
          </div>
        )}
      </div>

      {/* Screenshot */}
      {proof.screenshotUrl && (
        <div className="aspect-video overflow-hidden rounded-md bg-muted/20 border border-border/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proof.screenshotUrl}
            alt={`${cfg.label} engagement proof`}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Metrics grid */}
      {proof.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {proof.metrics.map((m, i) => (
            <div key={i} className="rounded-md bg-muted/20 px-3 py-2">
              <p className="text-xs font-semibold tabular-nums">{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.key}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload date */}
      {proof.uploadedAt && (
        <p className="text-[10px] text-muted-foreground/60">
          Uploaded {new Date(proof.uploadedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}
