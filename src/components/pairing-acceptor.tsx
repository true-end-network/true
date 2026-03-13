"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useContactStore } from "@/stores/contact-store"
import { Shield, UserCheck } from "lucide-react"

interface PairingAcceptorProps {
  sharedSecret: string
  onComplete: () => void
}

export function PairingAcceptor({ sharedSecret, onComplete }: PairingAcceptorProps) {
  const addContact = useContactStore((s) => s.addContact)
  const [name, setName] = useState("")

  function handleAccept() {
    if (!name.trim()) return
    addContact(name.trim(), sharedSecret)
    onComplete()
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-emerald-500 mb-2">
          <Shield className="h-5 w-5" />
          <span className="text-xs font-mono uppercase tracking-wider">Secure Pairing</span>
        </div>
        <CardTitle className="text-base">Accept Pairing</CardTitle>
        <CardDescription className="text-xs">
          Someone wants to pair with you. Name this contact to save it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Name this contact..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-sm"
          autoFocus
        />
        <Button className="w-full gap-2" onClick={handleAccept} disabled={!name.trim()}>
          <UserCheck className="h-4 w-4" />
          Accept & Save
        </Button>
      </CardContent>
    </Card>
  )
}
