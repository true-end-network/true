"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/chat-store"
import { Lock, Unlock, Skull, Clock, UserMinus, ChevronDown, ChevronUp } from "lucide-react"

export function RoomControls() {
  const deleteToken = useChatStore((s) => s.deleteToken)
  const roomLocked = useChatStore((s) => s.roomLocked)
  const peers = useChatStore((s) => s.peers)
  const lockRoom = useChatStore((s) => s.lockRoom)
  const unlockRoom = useChatStore((s) => s.unlockRoom)
  const updateTtl = useChatStore((s) => s.updateTtl)
  const kickPeer = useChatStore((s) => s.kickPeer)
  const killRoom = useChatStore((s) => s.killRoom)
  const [expanded, setExpanded] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)

  if (!deleteToken) return null

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <Lock className="h-3 w-3" />
        <span className="font-mono uppercase tracking-wider">Room Controls</span>
        {expanded ? <ChevronUp className="ml-auto h-3 w-3" /> : <ChevronDown className="ml-auto h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Lock / Unlock */}
          <div className="flex items-center gap-2">
            {roomLocked ? (
              <Button variant="outline" size="sm" className="gap-2 text-xs flex-1" onClick={unlockRoom}>
                <Unlock className="h-3 w-3" />
                Unlock Room
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-2 text-xs flex-1" onClick={lockRoom}>
                <Lock className="h-3 w-3" />
                Lock Room
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground font-mono">
              {roomLocked ? "Locked" : "Open"}
            </span>
          </div>

          {/* TTL Controls */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="font-mono uppercase tracking-wider">Time to Live</span>
            </div>
            <div className="flex gap-1.5">
              {[
                { label: "+15m", seconds: 900 },
                { label: "+1h", seconds: 3600 },
                { label: "+6h", seconds: 21600 },
                { label: "+24h", seconds: 86400 },
              ].map((opt) => (
                <Button
                  key={opt.label}
                  variant="outline"
                  size="sm"
                  className="text-[10px] flex-1 h-7"
                  onClick={() => updateTtl(opt.seconds)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Kick Peers */}
          {peers.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <UserMinus className="h-3 w-3" />
                <span className="font-mono uppercase tracking-wider">Peers ({peers.length})</span>
              </div>
              <div className="space-y-1">
                {peers.map((peerId) => (
                  <div key={peerId} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">
                      {peerId.slice(0, 12)}...
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-destructive hover:text-destructive"
                      onClick={() => kickPeer(peerId)}
                    >
                      Kick
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kill Switch */}
          <div className="pt-1">
            {confirmKill ? (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2 text-xs flex-1"
                  onClick={() => { killRoom(); setConfirmKill(false) }}
                >
                  <Skull className="h-3 w-3" />
                  Confirm Kill
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setConfirmKill(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmKill(true)}
              >
                <Skull className="h-3 w-3" />
                Kill Room
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
