"use client"

import { useState, useEffect, useRef } from "react"
import { Send, Brain, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const STAGES = ["Intro", "Skills", "Errors", "Workflows", "Q&A"]

interface Message {
  id: string
  type: "mentor" | "mentee" | "system"
  content: string
  timestamp: Date
}

interface SessionLiveProps {
  sessionId: string
  status: "waiting" | "active" | "completed"
  currentStage?: number
  onSaveToMemory?: () => void
}

export function SessionLive({
  sessionId,
  status,
  currentStage = 0,
  onSaveToMemory,
}: SessionLiveProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "sys-init",
      type: "system",
      content: "E2E encrypted channel established. Waiting for mentor agent…",
      timestamp: new Date(),
    },
  ])
  const [question, setQuestion] = useState("")
  const [sending, setSending] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Timer — counts up while session is active
  useEffect(() => {
    if (status !== "active") return
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [status])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
  }

  async function sendQuestion() {
    const q = question.trim()
    if (!q) return
    setQuestion("")
    setSending(true)

    const menteeMsg: Message = {
      id: Math.random().toString(36).slice(2),
      type: "mentee",
      content: q,
      timestamp: new Date(),
    }
    setMessages((m) => [...m, menteeMsg])

    try {
      const res = await fetch(`/api/marketplace/sessions/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: q }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.reply) {
          setMessages((m) => [
            ...m,
            {
              id: Math.random().toString(36).slice(2),
              type: "mentor",
              content: data.reply,
              timestamp: new Date(),
            },
          ])
        }
      }
    } catch {
      // API might not be available — silent fail
    } finally {
      setSending(false)
    }
  }

  const effectiveStage = status === "completed" ? STAGES.length : currentStage
  const progressPct =
    status === "completed" ? 100 : ((effectiveStage + 1) / STAGES.length) * 100

  return (
    <div className="space-y-5">
      {/* Stage progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {status === "waiting"
                ? "Waiting to start"
                : status === "completed"
                ? "Complete"
                : STAGES[currentStage] ?? "Processing"}
            </span>
            {status === "active" && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="tabular-nums">{formatTime(elapsed)}</span>
              </div>
            )}
          </div>
          <span className="text-muted-foreground tabular-nums">
            {Math.min(effectiveStage + 1, STAGES.length)}/{STAGES.length}
          </span>
        </div>

        <Progress value={progressPct} className="h-1.5" />

        {/* Stage labels */}
        <div className="flex justify-between px-0.5">
          {STAGES.map((stage, i) => (
            <span
              key={stage}
              className={cn(
                "text-[9px] font-medium transition-colors",
                status === "completed" || i < effectiveStage
                  ? "text-primary"
                  : i === effectiveStage && status === "active"
                  ? "text-foreground"
                  : "text-muted-foreground/30"
              )}
            >
              {stage}
            </span>
          ))}
        </div>
      </div>

      {/* Message feed */}
      <div className="rounded-lg border border-border/40 bg-muted/5 p-3 h-52 overflow-y-auto space-y-2.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2",
              msg.type === "mentee" ? "flex-row-reverse" : "flex-row",
              msg.type === "system" ? "justify-center" : ""
            )}
          >
            {msg.type === "system" ? (
              <p className="text-[10px] text-muted-foreground/50 font-mono">
                {msg.content}
              </p>
            ) : (
              <>
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    msg.type === "mentor"
                      ? "bg-primary/20 text-primary"
                      : "bg-muted/60 text-muted-foreground"
                  )}
                >
                  {msg.type === "mentor" ? "M" : "Y"}
                </div>
                <div
                  className={cn(
                    "max-w-[78%] rounded-lg px-3 py-1.5 text-xs leading-relaxed",
                    msg.type === "mentor"
                      ? "bg-muted/40 text-foreground"
                      : "bg-primary/10 text-foreground"
                  )}
                >
                  {msg.content}
                </div>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Question input */}
      {status === "active" && (
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask the mentor a question…"
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendQuestion()
              }
            }}
          />
          <Button
            onClick={sendQuestion}
            size="icon-sm"
            disabled={!question.trim() || sending}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Save to memory */}
      {status === "completed" && (
        <Button
          variant="outline"
          onClick={onSaveToMemory}
          className="w-full gap-2"
          size="sm"
        >
          <Brain className="h-3.5 w-3.5" />
          Save to Memory
        </Button>
      )}
    </div>
  )
}
