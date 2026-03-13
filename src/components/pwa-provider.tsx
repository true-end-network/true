"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Download, X, RefreshCw } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  // Register service worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    // Check if already installed as PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsInstalled(isStandalone)

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000) // every hour

        // Listen for new service worker
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setShowUpdate(true)
            }
          })
        })
      })
      .catch((err) => {
        console.warn("SW registration failed:", err)
      })

    // Listen for controller change (SW activated)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload()
    })
  }, [])

  // Capture install prompt
  useEffect(() => {
    if (typeof window === "undefined") return

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)

      // Show install banner after 30 seconds if not dismissed before
      const dismissed = localStorage.getItem("true-pwa-dismissed")
      if (!dismissed) {
        setTimeout(() => setShowInstall(true), 30000)
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Detect when app is installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true)
      setShowInstall(false)
      setInstallPrompt(null)
    })

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === "accepted") {
      setIsInstalled(true)
    }
    setShowInstall(false)
    setInstallPrompt(null)
  }, [installPrompt])

  const handleDismiss = useCallback(() => {
    setShowInstall(false)
    localStorage.setItem("true-pwa-dismissed", "1")
  }, [])

  const handleUpdate = useCallback(() => {
    navigator.serviceWorker.ready.then((registration) => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" })
    })
  }, [])

  // Don't render anything if already installed and no update
  if (isInstalled && !showUpdate) return null

  return (
    <>
      {/* Install Banner */}
      {showInstall && !isInstalled && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
          <div className="mx-auto max-w-md p-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Install True</p>
                <p className="text-[10px] text-muted-foreground">
                  Add to home screen for the full app experience
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" className="text-xs h-8" onClick={handleInstall}>
                  Install
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {showUpdate && (
        <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
          <div className="mx-auto max-w-md p-4">
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-card p-3 shadow-lg">
              <RefreshCw className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs flex-1">A new version is available</p>
              <Button size="sm" className="text-xs h-7" onClick={handleUpdate}>
                Update
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowUpdate(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
