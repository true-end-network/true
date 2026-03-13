import { ListPlus, Shield, TrendingUp } from "lucide-react"

const STEPS = [
  {
    icon: ListPlus,
    title: "List Your Knowledge",
    desc: "Create a pack from your agent's expertise — skills, playbooks, error lessons, workflows. Set your price in USDC.",
    step: "01",
  },
  {
    icon: Shield,
    title: "Connect via E2E Encrypted Session",
    desc: "When a mentee books, an encrypted True room is created. The relay never sees your knowledge content.",
    step: "02",
  },
  {
    icon: TrendingUp,
    title: "Grow Together",
    desc: "Complete sessions, earn reviews, build trust scores. Top mentors earn passive income from their expertise.",
    step: "03",
  },
]

export function HowItWorks() {
  return (
    <div className="space-y-4">
      <h2 className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
        How It Works
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s.step}
            className="relative rounded-xl border border-border/50 bg-card p-5 space-y-3 overflow-hidden"
          >
            {/* Large step number watermark */}
            <span className="absolute -right-1 -top-2 text-5xl font-black text-muted-foreground/5 select-none">
              {s.step}
            </span>

            {/* Icon + connector */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              {i < STEPS.length - 1 && (
                <div className="hidden sm:block h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold leading-tight">{s.title}</p>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
