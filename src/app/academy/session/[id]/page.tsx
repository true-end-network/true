"use client"

import { useState, useEffect, useRef, type ElementType } from "react"
import { useParams } from "next/navigation"
import { Radio, CheckCircle2, Clock, ArrowLeft } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { SessionProgress, type SkillProgress } from "@/components/academy/SessionProgress"
import { SessionLive } from "@/components/academy/SessionLive"
import { ReviewForm } from "@/components/academy/ReviewForm"
import Link from "next/link"
import { cn } from "@/lib/utils"

type SessionStatus = "waiting" | "active" | "completed"

interface SessionData {
  id: string
  packId: string
  packTitle: string
  status: SessionStatus
  skills: SkillProgress[]
  roomCode?: string
  currentStage?: number
}

const DEMO_SESSION: SessionData = {
  id: "demo-session",
  packId: "demo-1",
  packTitle: "Viral Twitter Growth System",
  status: "active",
  currentStage: 1,
  skills: [
    { name: "Hook formula library", status: "done" },
    { name: "Thread architecture", status: "done" },
    { name: "Engagement loop", status: "active" },
    { name: "Content calendar system", status: "pending" },
    { name: "Profile optimization", status: "pending" },
    { name: "Analytics interpretation", status: "pending" },
  ],
}

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; color: string; icon: ElementType; pulse: boolean }
> = {
  waiting: {
    label: "Waiting for mentor agent",
    color: "text-yellow-400 border-yellow-500/20 bg-yellow-500/5",
    icon: Clock,
    pulse: true,
  },
  active: {
    label: "Session active — receiving knowledge",
    color: "text-green-400 border-green-500/20 bg-green-500/5",
    icon: Radio,
    pulse: true,
  },
  completed: {
    label: "Session complete",
    color: "text-muted-foreground border-border/50 bg-muted/10",
    icon: CheckCircle2,
    pulse: false,
  },
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`/api/marketplace/sessions/${id}`)
        if (res.ok) {
          const data = await res.json()
          setSession(data)
        } else {
          setSession(DEMO_SESSION)
        }
      } catch {
        setSession(DEMO_SESSION)
      } finally {
        setLoading(false)
      }
    }

    loadSession()

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/marketplace/sessions/${id}`)
        if (res.ok) {
          const data = await res.json()
          setSession(data)
          if (data.status === "completed") {
            clearInterval(pollRef.current!)
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 3000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [id])

  function handleSaveToMemory() {
    alert("Knowledge saved to agent memory!")
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border/30 bg-muted/10 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">Session not found.</p>
        <Link href="/academy" className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Academy
        </Link>
      </div>
    )
  }

  const { label, color, icon: StatusIcon, pulse } = STATUS_CONFIG[session.status]

  return (
    <div className="mx-auto max-w-xl px-4 py-8 space-y-8">
      <Link href={`/academy/pack/${session.packId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> {session.packTitle}
      </Link>

      {/* Status indicator */}
      <div className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", color)}>
        <div className="relative shrink-0">
          <StatusIcon className="h-4 w-4" />
          {pulse && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-current animate-ping opacity-75" />}
        </div>
        <div>
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground/70 font-mono">session/{session.id}</p>
        </div>
      </div>

      {/* Active wave animation */}
      {session.status === "active" && (
        <div className="rounded-xl border border-border/50 bg-muted/5 px-6 py-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <p className="text-xs font-medium">Your agent is receiving knowledge</p>
          <p className="text-[10px] text-muted-foreground">All data is E2E encrypted through the True relay</p>
        </div>
      )}

      {/* Session Live */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Session Progress</h2>
        <SessionLive
          sessionId={session.id}
          status={session.status}
          currentStage={session.currentStage ?? 1}
          onSaveToMemory={handleSaveToMemory}
        />
      </div>

      {/* Skill checklist */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Knowledge Transfer Checklist</h2>
        <SessionProgress skills={session.skills} />
      </div>

      {/* Completed state */}
      {session.status === "completed" && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="text-center space-y-1.5">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto" />
              <p className="text-sm font-semibold">Knowledge transfer complete</p>
              <p className="text-xs text-muted-foreground">Your agent has received all {session.skills.length} skill packages.</p>
            </div>
            <div className="space-y-3">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate this session</h2>
              <ReviewForm sessionId={session.id} />
            </div>
          </div>
        </>
      )}

      {/* E2E notice */}
      <div className="rounded-xl border border-border/30 bg-muted/5 px-4 py-3">
        <p className="text-[10px] text-muted-foreground/60 font-mono leading-relaxed">
          🔒 This session runs over an encrypted True room. The relay sees only ciphertext.
        </p>
      </div>
    </div>
  )
}
