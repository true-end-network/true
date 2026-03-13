"use client"

import { useState, useEffect, useRef } from "react"
import { deriveContactRoomCode, deriveRoomHash, getTodayUTC } from "@/lib/crypto"

const POLL_INTERVAL = 30000

function getRelayHttpUrl(): string {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol
    return process.env.NEXT_PUBLIC_RELAY_URL
      ? process.env.NEXT_PUBLIC_RELAY_URL.replace(/^ws/, "http")
      : `${proto}//${window.location.host}`
  }
  return "http://localhost:3001"
}

export function usePresence(contacts: { id: string; sharedSecret: string }[]) {
  const [online, setOnline] = useState<Record<string, boolean>>({})
  const contactsRef = useRef(contacts)
  contactsRef.current = contacts

  useEffect(() => {
    if (contacts.length === 0) return

    let cancelled = false

    async function checkPresence() {
      const current = contactsRef.current
      const baseUrl = getRelayHttpUrl()
      const today = getTodayUTC()
      const results: Record<string, boolean> = {}

      await Promise.all(
        current.map(async (contact) => {
          try {
            const roomCode = deriveContactRoomCode(contact.sharedSecret, today, 0)
            const roomHash = deriveRoomHash(roomCode)
            const res = await fetch(`${baseUrl}/rooms/${roomHash}/poll?since=0`, {
              signal: AbortSignal.timeout(5000),
            })
            if (res.ok) {
              const data = await res.json()
              results[contact.id] = data.peerCount > 0
            } else {
              results[contact.id] = false
            }
          } catch {
            results[contact.id] = false
          }
        })
      )

      if (!cancelled) {
        setOnline(results)
      }
    }

    checkPresence()
    const interval = setInterval(checkPresence, POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  // Only re-run when the contact IDs change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.map((c) => c.id).join(",")])

  return online
}
