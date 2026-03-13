"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PairingInitiator } from "@/components/pairing-initiator"
import { PairingAcceptor } from "@/components/pairing-acceptor"
import { QrScanner } from "@/components/qr-scanner"
import { decodePairingFragment } from "@/lib/crypto"
import { ArrowLeft, ScanLine } from "lucide-react"

export default function PairPage() {
  const router = useRouter()
  const [incomingSecret, setIncomingSecret] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [scanning, setScanning] = useState(false)

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

  function handleScan(data: string) {
    setScanning(false)
    try {
      const url = new URL(data)
      const fragment = url.hash.slice(1)
      if (fragment) {
        const secret = decodePairingFragment(fragment)
        if (secret) {
          setIncomingSecret(secret)
          return
        }
      }
    } catch {
      // Not a URL, try as raw fragment
      const secret = decodePairingFragment(data)
      if (secret) {
        setIncomingSecret(secret)
        return
      }
    }
  }

  if (!checked) return null

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 pt-[calc(3rem+env(safe-area-inset-top))]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Pair</h1>
            <p className="text-xs text-muted-foreground">
              {incomingSecret ? "Accept an incoming pairing" : "Create or scan a pairing"}
            </p>
          </div>
          {!incomingSecret && !scanning && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setScanning(true)}>
              <ScanLine className="h-3 w-3" />
              Scan QR
            </Button>
          )}
        </div>

        {scanning && (
          <QrScanner
            onScan={handleScan}
            onClose={() => setScanning(false)}
          />
        )}

        {incomingSecret ? (
          <PairingAcceptor sharedSecret={incomingSecret} onComplete={handleComplete} />
        ) : (
          !scanning && <PairingInitiator onComplete={handleComplete} />
        )}

        <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
          The pairing secret never leaves your browser. The server never sees it.
        </p>
      </div>
    </main>
  )
}
