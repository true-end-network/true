"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PackCard, type Pack } from "./PackCard"

interface FeaturedPacksProps {
  packs: Pack[]
}

export function FeaturedPacks({ packs }: FeaturedPacksProps) {
  const perPage = 3
  const [page, setPage] = useState(0)
  const pages = Math.ceil(packs.length / perPage)
  const visible = packs.slice(page * perPage, (page + 1) * perPage)

  if (packs.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-orange-400" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Featured Packs
          </h2>
        </div>
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {page + 1}/{pages}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page === pages - 1}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="sm:hidden flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none">
        {packs.map((pack) => (
          <div key={pack.id} className="min-w-[280px] snap-start">
            <PackCard pack={pack} />
          </div>
        ))}
      </div>

      {/* Desktop: paginated grid */}
      <div className="hidden sm:grid gap-3 sm:grid-cols-3">
        {visible.map((pack) => (
          <PackCard key={pack.id} pack={pack} />
        ))}
      </div>

      {/* Dots */}
      {pages > 1 && (
        <div className="hidden sm:flex justify-center gap-1.5 pt-1">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`h-1 rounded-full transition-all ${
                i === page ? "w-4 bg-primary" : "w-1 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
