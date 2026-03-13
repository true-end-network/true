"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PairingInitiator } from "@/components/pairing-initiator"
import { PairingAcceptor } from "@/components/pairing-acceptor"
import { decodePairingFragment } from "@/lib/crypto"
import { ArrowLeft } from "lucide-react"

export default function PairPage() {
  const router = useRouter()
  const [incomingSecret, setIncomingSecret] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const fragment = window.location.hash.slice(1)
    if (fragment) {
      const secret = decodePairingFragment(fragment)
      if (secret) {
        setIncomingSecret(secret)
      }
    }
    setChecked(true)
  }, [])

  function handleComplete() {
    router.push("/contacts")
  }

  if (!checked) return null

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 pt-[calc(3rem+env(safe-area-inset-top))]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Pair</h1>
            <p className="text-xs text-muted-foreground">
              {incomingSecret ? "Accept an incoming pairing" : "Create a secure pairing link"}
            </p>
          </div>
        </div>

        {incomingSecret ? (
          <PairingAcceptor sharedSecret={incomingSecret} onComplete={handleComplete} />
        ) : (
          <PairingInitiator onComplete={handleComplete} />
        )}

        <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
          The pairing secret never leaves your browser. The server never sees it.
        </p>
      </div>
    </main>
  )
}
