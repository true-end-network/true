"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChatObserver } from "@/components/chat-observer"
import { RoomInfo } from "@/components/room-info"
import { useChatStore } from "@/stores/chat-store"
import { decodeRoomFragment } from "@/lib/crypto"
import { ArrowLeft, Shield, Loader2 } from "lucide-react"

export default function ObserveRoomPage() {
  const router = useRouter()
  const connect = useChatStore((s) => s.connect)
  const disconnect = useChatStore((s) => s.disconnect)
  const error = useChatStore((s) => s.error)
  const roomCodePreview = useChatStore((s) => s.roomCodePreview)
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    const fragment = window.location.hash.slice(1)
    if (!fragment) {
      setInvalid(true)
      return
    }

    const roomCode = decodeRoomFragment(fragment)
    if (!roomCode) {
      setInvalid(true)
      return
    }

    connect(roomCode)
    setReady(true)

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  function handleBack() {
    disconnect()
    router.push("/")
  }

  if (invalid) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">Invalid room code</p>
          <Button variant="outline" onClick={handleBack}>
            Go back
          </Button>
        </div>
      </main>
    )
  }

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">True</span>
          {roomCodePreview && (
            <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
              {roomCodePreview}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-500">
          <Shield className="h-3 w-3" />
          <span className="font-mono">E2E</span>
        </div>
      </header>

      <RoomInfo />

      {error && (
        <div className="mx-4 mt-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <ChatObserver />
    </main>
  )
}
