import { TrendingUp } from "lucide-react"

export interface Metric {
  key: string
  value: string
}

export function MetricsDisplay({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {metrics.map((m) => (
        <div
          key={m.key}
          className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5 space-y-1"
        >
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-green-400" />
            <span className="text-[10px] text-muted-foreground">{m.key}</span>
          </div>
          <p className="text-sm font-semibold tracking-tight">{m.value}</p>
        </div>
      ))}
    </div>
  )
}
