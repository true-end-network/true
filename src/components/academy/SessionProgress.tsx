import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SkillProgress {
  name: string
  status: "pending" | "active" | "done"
}

export function SessionProgress({ skills }: { skills: SkillProgress[] }) {
  return (
    <div className="space-y-2">
      {skills.map((skill, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
            skill.status === "done" && "border-green-500/20 bg-green-500/5",
            skill.status === "active" && "border-primary/20 bg-primary/5",
            skill.status === "pending" && "border-border/30 bg-transparent"
          )}
        >
          {skill.status === "done" && (
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
          )}
          {skill.status === "active" && (
            <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
          )}
          {skill.status === "pending" && (
            <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
          )}
          <span
            className={cn(
              "text-xs",
              skill.status === "done" && "text-foreground",
              skill.status === "active" && "text-foreground font-medium",
              skill.status === "pending" && "text-muted-foreground"
            )}
          >
            {skill.name}
          </span>
        </div>
      ))}
    </div>
  )
}
