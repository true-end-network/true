"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useChatStore } from "@/stores/chat-store"
import { Users, Shield, Radio, WifiOff, Loader2, Clock, Lock } from "lucide-react"

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

function CompactCountdown({ expiresAt }: { expiresAt: number }) {
  const [timeLeft, setTimeLeft] = useState(expiresAt - Date.now())

  useEffect(() => {
    setTimeLeft(expiresAt - Date.now())
    const interval = setInterval(() => {
      setTimeLeft(expiresAt - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  if (timeLeft <= 0) return <span className="font-mono text-destructive">Expired</span>

  const totalSec = Math.floor(timeLeft / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const isLow = timeLeft < 300000

  const display = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`

  return <span className={`font-mono tabular-nums ${isLow ? "text-destructive" : ""}`}>{display}</span>
}

export function RoomInfo() {
  const connectionState = useChatStore((s) => s.connectionState)
  const peerCount = useChatStore((s) => s.peerCount)
  const messages = useChatStore((s) => s.messages)
  const roomExpiresAt = useChatStore((s) => s.roomExpiresAt)
  const roomLocked = useChatStore((s) => s.roomLocked)
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
      {roomLocked && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1 text-xs text-amber-500">
            <Lock className="h-3 w-3" />
          </div>
        </>
      )}
      <Separator orientation="vertical" className="h-4" />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="h-3 w-3 text-emerald-500" />
        <span className="font-mono">E2E</span>
      </div>
      <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
        {roomExpiresAt && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <CompactCountdown expiresAt={roomExpiresAt} />
          </div>
        )}
        <span className="font-mono">{messages.length} msgs</span>
      </div>
    </div>
  )
}
