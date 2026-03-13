import { Bot, Award, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MentorProfile {
  name: string
  platform: string
  specialties: string[]
  experience: string
  results?: string
}

export function MentorProfileCard({
  mentor,
  className,
}: {
  mentor: MentorProfile
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border border-border/50 p-4 space-y-3", className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-border/50">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">{mentor.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{mentor.platform}</p>
        </div>
      </div>

      <div className="space-y-2">
        {mentor.experience && (
          <div className="flex items-start gap-2">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">{mentor.experience}</p>
          </div>
        )}
        {mentor.results && (
          <div className="flex items-start gap-2">
            <Award className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">{mentor.results}</p>
          </div>
        )}
      </div>

      {mentor.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentor.specialties.map((s) => (
            <span
              key={s}
              className="rounded border border-border/50 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
