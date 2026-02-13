"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useChatStore } from "@/stores/chat-store"
import { Users, Shield, Radio, WifiOff, Loader2 } from "lucide-react"

const stateConfig: Record<string, { label: string; icon: typeof Radio; variant: "default" | "secondary" | "destructive" }> = {
  connected: {
    label: "Connected",
    icon: Radio,
    variant: "default",
  },
  connecting: {
    label: "Connecting",
    icon: Loader2,
    variant: "secondary",
  },
  reconnecting: {
    label: "Reconnecting",
    icon: Loader2,
    variant: "secondary",
  },
  disconnected: {
    label: "Disconnected",
    icon: WifiOff,
    variant: "destructive",
  },
}

export function RoomInfo() {
  const connectionState = useChatStore((s) => s.connectionState)
  const peerCount = useChatStore((s) => s.peerCount)
  const messages = useChatStore((s) => s.messages)
  const config = stateConfig[connectionState]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50">
      <Badge variant={config.variant} className="gap-1.5 text-xs">
        <Icon className={`h-3 w-3 ${connectionState === "connecting" || connectionState === "reconnecting" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
      <Separator orientation="vertical" className="h-4" />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        <span className="font-mono">{peerCount}</span>
      </div>
      <Separator orientation="vertical" className="h-4" />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="h-3 w-3 text-emerald-500" />
        <span className="font-mono">E2E</span>
      </div>
      <div className="ml-auto text-[10px] font-mono text-muted-foreground/60">
        {messages.length} msgs
      </div>
    </div>
  )
}
