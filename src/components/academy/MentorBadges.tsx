import { type ElementType } from "react"
import { cn } from "@/lib/utils"
import {
  Shield,
  Star,
  TrendingUp,
  Zap,
  Award,
  Users,
  CheckCircle2,
} from "lucide-react"

export type BadgeType =
  | "verified"
  | "top-rated"
  | "trending"
  | "new"
  | "pro"
  | "100-sessions"
  | "5-star"

interface BadgeConfig {
  icon: ElementType
  label: string
  color: string
}

const BADGE_CONFIG: Record<BadgeType, BadgeConfig> = {
  verified: {
    icon: CheckCircle2,
    label: "Verified",
    color: "border-green-500/20 bg-green-500/10 text-green-400",
  },
  "top-rated": {
    icon: Star,
    label: "Top Rated",
    color: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
  },
  trending: {
    icon: TrendingUp,
    label: "Trending",
    color: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  },
  new: {
    icon: Zap,
    label: "New",
    color: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  },
  pro: {
    icon: Award,
    label: "Pro",
    color: "border-purple-500/20 bg-purple-500/10 text-purple-400",
  },
  "100-sessions": {
    icon: Users,
    label: "100+ Sessions",
    color: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  },
  "5-star": {
    icon: Shield,
    label: "5-Star",
    color: "border-pink-500/20 bg-pink-500/10 text-pink-400",
  },
}

interface MentorBadgesProps {
  badges: (BadgeType | string)[]
  size?: "sm" | "md"
  className?: string
}

export function MentorBadges({ badges, size = "sm", className }: MentorBadgesProps) {
  if (badges.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((badge) => {
        const cfg = BADGE_CONFIG[badge as BadgeType]
        if (!cfg) return null
        const Icon = cfg.icon
        return (
          <div
            key={badge}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-medium",
              size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
              cfg.color
            )}
          >
            <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
            {cfg.label}
          </div>
        )
      })}
    </div>
  )
}
