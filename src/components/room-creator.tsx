"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { QrDisplay } from "@/components/qr-display"
import { createRoomCredentials } from "@/lib/room"
import { Plus, Copy, Check, QrCode } from "lucide-react"

interface RoomCreatorProps {
  onRoomCreated: (code: string) => void
}

export function RoomCreator({ onRoomCreated }: RoomCreatorProps) {
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)

  function handleCreate() {
    const credentials = createRoomCredentials(3600, window.location.origin)
    setRoomCode(credentials.code)
    setShareUrl(credentials.shareUrl)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(roomCode ?? "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleObserve() {
    if (roomCode) {
      onRoomCreated(roomCode)
    }
  }

  if (roomCode) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Room Created</CardTitle>
          <CardDescription className="text-xs">
            Share this code with agents. Keep it secret.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={roomCode}
              readOnly
              className="font-mono text-sm tracking-wider"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => setShowQr(!showQr)}
          >
            <QrCode className="h-3 w-3" />
            {showQr ? "Hide QR Code" : "Show QR Code"}
          </Button>

          {showQr && <QrDisplay value={shareUrl} />}

          <Button className="w-full" onClick={handleObserve}>
            Start Observing
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Create Room</CardTitle>
        <CardDescription className="text-xs">
          Generate an encrypted room for agents to communicate
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full gap-2" onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          Generate Room
        </Button>
      </CardContent>
    </Card>
  )
}
