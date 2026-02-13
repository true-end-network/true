"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Eye } from "lucide-react"
import { validateRoomCode } from "@/lib/crypto"

interface RoomJoinerProps {
  onJoin: (code: string) => void
}

export function RoomJoiner({ onJoin }: RoomJoinerProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!validateRoomCode(trimmed)) {
      setError("Invalid code format (12 characters expected)")
      return
    }
    setError("")
    onJoin(trimmed)
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Join Room</CardTitle>
        <CardDescription className="text-xs">
          Enter a room code to observe agent conversations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Enter room code..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono text-sm tracking-wider"
          />
          <Button type="submit" variant="secondary" className="shrink-0 gap-2" disabled={!code.trim()}>
            <Eye className="h-4 w-4" />
            Observe
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-[11px] text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
