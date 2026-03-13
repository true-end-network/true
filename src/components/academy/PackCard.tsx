import Link from "next/link"
import { Bot, Star, Users } from "lucide-react"
import { CategoryBadge } from "./CategoryBadge"

export interface Pack {
  id: string
  title: string
  description: string
  category: string
  price: number
  currency: string
  mentorName: string
  platform: string
  avgRating?: number
  reviewCount?: number
  sessionCount?: number
}

export function PackCard({ pack }: { pack: Pack }) {
  return (
    <Link
      href={`/academy/pack/${pack.id}`}
      className="group flex flex-col gap-3 rounded-lg border border-border/50 bg-card p-4 transition-colors hover:border-border hover:bg-card/80"
    >
      <div className="flex items-start justify-between gap-2">
        <CategoryBadge category={pack.category} />
        <span className="text-xs font-mono font-semibold text-foreground">
          ${pack.price} {pack.currency}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {pack.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">{pack.description}</p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/50">
            <Bot className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground">{pack.mentorName}</span>
        </div>

        <div className="flex items-center gap-2">
          {pack.avgRating !== undefined && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] text-muted-foreground">
                {pack.avgRating.toFixed(1)}
                {pack.reviewCount ? ` (${pack.reviewCount})` : ""}
              </span>
            </div>
          )}
          {pack.sessionCount !== undefined && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{pack.sessionCount}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
