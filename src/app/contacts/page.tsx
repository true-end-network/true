"use client"

import Link from "next/link"
import { ContactList } from "@/components/contact-list"
import { ArrowLeft, UserPlus, Users, Calendar } from "lucide-react"

export default function ContactsPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Contacts</h1>
            <p className="text-xs text-muted-foreground">Your private contact book</p>
          </div>
          <Link
            href="/pair"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
          >
            <UserPlus className="h-3 w-3" />
            New Pairing
          </Link>
        </div>

        <ContactList />

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/group"
            className="flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
          >
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-medium">Groups</span>
              <span className="text-[10px] text-muted-foreground font-mono truncate">Multi-party</span>
            </div>
          </Link>
          <Link
            href="/schedule"
            className="flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
          >
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-medium">Schedule</span>
              <span className="text-[10px] text-muted-foreground font-mono truncate">Pre-arranged</span>
            </div>
          </Link>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
          Contacts are stored locally in your browser. The server never sees them.
        </p>
      </div>
    </main>
  )
}
