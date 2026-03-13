"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { QrDisplay } from "@/components/qr-display"
import { useContactStore } from "@/stores/contact-store"
import { encodePairingUrl } from "@/lib/crypto"
import { Copy, Check, QrCode, UserPlus } from "lucide-react"

interface PairingInitiatorProps {
  onComplete: () => void
}

export function PairingInitiator({ onComplete }: PairingInitiatorProps) {
  const createPairing = useContactStore((s) => s.createPairing)
  const addContact = useContactStore((s) => s.addContact)
  const [secret, setSecret] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)

  function handleGenerate() {
    setSecret(createPairing())
  }

  async function handleCopy() {
    if (!secret) return
    const url = encodePairingUrl(window.location.origin, secret)
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSave() {
    if (!secret || !name.trim()) return
    addContact(name.trim(), secret)
    onComplete()
  }

  if (!secret) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create Pairing</CardTitle>
          <CardDescription className="text-xs">
            Generate a secret link to pair with another person
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full gap-2" onClick={handleGenerate}>
            <UserPlus className="h-4 w-4" />
            Generate Pairing Link
          </Button>
        </CardContent>
      </Card>
    )
  }

  const pairingUrl = encodePairingUrl(window.location.origin, secret)

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Share This Link</CardTitle>
        <CardDescription className="text-xs">
          Send this to the person you want to pair with. Keep it secret — anyone with this link can pair with you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={pairingUrl}
            readOnly
            className="font-mono text-[10px] tracking-wider"
          />
          <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
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

        {showQr && <QrDisplay value={pairingUrl} />}

        <div className="space-y-2 pt-2">
          <Input
            placeholder="Name this contact..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm"
          />
          <Button className="w-full" onClick={handleSave} disabled={!name.trim()}>
            Save Contact
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
