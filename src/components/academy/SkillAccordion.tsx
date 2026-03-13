"use client"

import { useState } from "react"
import { ChevronDown, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Skill {
  name: string
  description?: string
}

export function SkillAccordion({ skills }: { skills: Skill[] }) {
  const [open, setOpen] = useState(false)
  const preview = skills.slice(0, 3)
  const rest = skills.slice(3)

  return (
    <div className="space-y-1.5">
      {preview.map((skill) => (
        <SkillRow key={skill.name} skill={skill} />
      ))}

      {rest.length > 0 && (
        <>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300",
              open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="space-y-1.5 pt-1.5">
              {rest.map((skill) => (
                <SkillRow key={skill.name} skill={skill} />
              ))}
            </div>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-300",
                open && "rotate-180"
              )}
            />
            {open ? "Show less" : `+${rest.length} more skills`}
          </button>
        </>
      )}
    </div>
  )
}

function SkillRow({ skill }: { skill: Skill }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border/30 bg-muted/10 px-3 py-2">
      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-medium">{skill.name}</p>
        {skill.description && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{skill.description}</p>
        )}
      </div>
    </div>
  )
}
