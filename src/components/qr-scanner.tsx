"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Camera, X, AlertCircle } from "lucide-react"

interface QrScannerProps {
  onScan: (data: string) => void
  onClose: () => void
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let mounted = true

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode")

        if (!mounted || !containerRef.current) return

        const scanner = new Html5Qrcode("qr-reader")
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            onScan(decodedText)
            scanner.stop().catch(() => {})
          },
          () => {
            // Ignore scan failures (no QR found in frame)
          }
        )

        if (mounted) setStarting(false)
      } catch (err) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : "Camera access denied"
          setError(msg.includes("NotAllowed") || msg.includes("Permission")
            ? "Camera permission denied. Please allow camera access and try again."
            : `Could not start camera: ${msg}`)
          setStarting(false)
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [onScan])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Camera className="h-3 w-3" />
          <span className="font-mono uppercase tracking-wider">
            {starting ? "Starting camera..." : "Scan QR Code"}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-center space-y-2">
          <AlertCircle className="h-6 w-6 mx-auto text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg border border-border/50 bg-black">
          <div id="qr-reader" ref={containerRef} className="w-full" />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center space-y-2">
                <Camera className="h-8 w-8 mx-auto text-muted-foreground animate-pulse" />
                <p className="text-xs text-muted-foreground">Requesting camera...</p>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center font-mono">
        Point your camera at a True pairing QR code
      </p>
    </div>
  )
}
