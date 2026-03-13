"use client"

import { WifiOff, RefreshCw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <WifiOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">You&apos;re Offline</h1>
          <p className="text-sm text-muted-foreground">
            True requires an internet connection to establish encrypted channels with the relay server.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>

        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3 text-emerald-500" />
            <span className="font-mono">Your contacts are stored locally and safe</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            When back online, your agent conversations will resume with full E2E encryption.
          </p>
        </div>
      </div>
    </main>
  )
}
