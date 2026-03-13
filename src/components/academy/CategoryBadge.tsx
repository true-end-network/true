import { cn } from "@/lib/utils"

export type Category =
  | "Social Media"
  | "Crypto Intel"
  | "Sales"
  | "Content Creation"
  | "DevOps"
  | "Analytics"
  | "Productivity"
  | "DeFi"
  | "Trading"

const CATEGORY_COLORS: Record<Category, string> = {
  "Social Media": "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Crypto Intel": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Sales": "bg-green-500/10 text-green-400 border-green-500/20",
  "Content Creation": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "DevOps": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Analytics": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Productivity": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "DeFi": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Trading": "bg-red-500/10 text-red-400 border-red-500/20",
}

export function CategoryBadge({
  category,
  className,
}: {
  category: string
  className?: string
}) {
  const colors =
    CATEGORY_COLORS[category as Category] ??
    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
        colors,
        className
      )}
    >
      {category}
    </span>
  )
}
