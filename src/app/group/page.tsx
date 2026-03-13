"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useContactStore, type Contact } from "@/stores/contact-store"
import { encodeBase64, decodeUTF8 } from "tweetnacl-util"
import { ArrowLeft, Users, Check, MessageSquare } from "lucide-react"

function ContactSelector({
  contacts,
  selected,
  onToggle,
}: {
  contacts: Contact[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-1.5">
      {contacts.map((c) => (
        <button
          key={c.id}
          onClick={() => onToggle(c.id)}
          className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
            selected.has(c.id)
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border/50 hover:bg-muted/50 text-muted-foreground"
          }`}
        >
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              selected.has(c.id) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
            }`}
          >
            {selected.has(c.id) && <Check className="h-3 w-3" />}
          </div>
          <span className="truncate">{c.name}</span>
        </button>
      ))}
    </div>
  )
}

export default function GroupPage() {
  const router = useRouter()
  const contacts = useContactStore((s) => s.contacts)
  const groups = useContactStore((s) => s.groups)
  const addGroup = useContactStore((s) => s.addGroup)
  const removeGroup = useContactStore((s) => s.removeGroup)
  const deriveGroupRoom = useContactStore((s) => s.deriveGroupRoom)
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  function toggleContact(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleCreate() {
    if (name.trim() && selected.size >= 2) {
      addGroup(name.trim(), Array.from(selected))
      setName("")
      setSelected(new Set())
      setCreating(false)
    }
  }

  function handleOpenGroup(groupId: string) {
    const result = deriveGroupRoom(groupId)
    if (result) {
      const encoded = encodeBase64(decodeUTF8(result.roomCode))
      router.push(`/room/observe#${encoded}`)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/contacts" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Group Rooms</h1>
            <p className="text-xs text-muted-foreground">Multi-party agent conversations</p>
          </div>
          {!creating && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCreating(true)}>
              <Users className="h-3 w-3" />
              New Group
            </Button>
          )}
        </div>

        {creating && (
          <Card className="border-primary/20">
            <CardContent className="space-y-4 p-4">
              <Input
                placeholder="Group name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm"
                autoFocus
              />
              {contacts.length < 2 ? (
                <p className="text-xs text-muted-foreground">
                  You need at least 2 contacts to create a group.
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                    Select contacts ({selected.size} selected)
                  </p>
                  <ContactSelector contacts={contacts} selected={selected} onToggle={toggleContact} />
                </>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  disabled={!name.trim() || selected.size < 2}
                  onClick={handleCreate}
                >
                  Create Group
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {groups.length === 0 && !creating ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No groups yet</p>
            <p className="text-xs mt-1">Create a group with 2+ contacts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <Card key={group.id} className="border-border/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{group.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {group.contactIds.length} members
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="default" size="sm" className="gap-1.5 text-xs" onClick={() => handleOpenGroup(group.id)}>
                      <MessageSquare className="h-3 w-3" />
                      Chat
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => removeGroup(group.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
          Group rooms are derived deterministically from all members&apos; shared secrets.
        </p>
      </div>
    </main>
  )
}
