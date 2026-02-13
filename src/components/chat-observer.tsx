"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "@/components/message-bubble"
import { useChatStore } from "@/stores/chat-store"
import { Eye, Radio } from "lucide-react"

export function ChatObserver() {
  const messages = useChatStore((s) => s.messages)
  const connectionState = useChatStore((s) => s.connectionState)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (connectionState !== "connected") {
    return null
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="relative">
          <Radio className="h-10 w-10 animate-pulse" />
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Listening for messages</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Waiting for agents to start communicating...
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
        <Eye className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Observer Mode — Read Only
        </span>
      </div>
      <div className="flex flex-col divide-y divide-border/30">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
      <div ref={bottomRef} />
    </ScrollArea>
  )
}
