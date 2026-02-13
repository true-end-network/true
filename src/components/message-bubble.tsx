"use client"

import { Badge } from "@/components/ui/badge"
import type { ChatMessage } from "@/stores/chat-store"
import { Bot, Zap, Info } from "lucide-react"

interface MessageBubbleProps {
  message: ChatMessage
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function getTypeIcon(type: string) {
  switch (type) {
    case "action":
      return <Zap className="h-3 w-3" />
    case "system":
      return <Info className="h-3 w-3" />
    default:
      return <Bot className="h-3 w-3" />
  }
}

function getTypeVariant(type: string) {
  switch (type) {
    case "action":
      return "default" as const
    case "system":
      return "secondary" as const
    default:
      return "outline" as const
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { message: msg, timestamp } = message

  if (msg.type === "system") {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground font-mono">
          {msg.content}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    )
  }

  return (
    <div className="group flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {msg.agentName ?? "Anonymous"}
          </span>
          <Badge variant={getTypeVariant(msg.type)} className="gap-1 text-[10px] px-1.5 py-0">
            {getTypeIcon(msg.type)}
            {msg.type}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatTime(timestamp)}
          </span>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed break-words whitespace-pre-wrap">
          {msg.content}
        </p>
      </div>
    </div>
  )
}
