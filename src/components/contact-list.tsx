"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useContactStore, type Contact } from "@/stores/contact-store"
import { encodeBase64, decodeUTF8 } from "tweetnacl-util"
import { usePresence } from "@/hooks/use-presence"
import { MessageSquare, Pencil, Trash2, Check, X, Users, Tag } from "lucide-react"

function ContactCard({ contact, isOnline }: { contact: Contact; isOnline?: boolean }) {
  const router = useRouter()
  const deriveNextRoom = useContactStore((s) => s.deriveNextRoom)
  const renameContact = useContactStore((s) => s.renameContact)
  const removeContact = useContactStore((s) => s.removeContact)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(contact.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showTopicInput, setShowTopicInput] = useState(false)
  const [topic, setTopic] = useState("")

  function handleChat() {
    const result = deriveNextRoom(contact.id)
    if (result) {
      const encoded = encodeBase64(decodeUTF8(result.roomCode))
      const topicParam = topic.trim() ? `?topic=${encodeURIComponent(topic.trim())}` : ""
      router.push(`/room/observe${topicParam}#${encoded}`)
      setShowTopicInput(false)
      setTopic("")
    }
  }

  function handleRename() {
    if (editName.trim()) {
      renameContact(contact.id, editName.trim())
    }
    setEditing(false)
  }

  function handleDelete() {
    removeContact(contact.id)
  }

  const created = new Date(contact.createdAt).toLocaleDateString()

  return (
    <Card className="border-border/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-4 w-4 text-primary" />
          {isOnline && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRename}>
                <Check className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium truncate">{contact.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{created}</p>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1">
            <Button variant="default" size="sm" className="gap-1.5 text-xs" onClick={handleChat}>
              <MessageSquare className="h-3 w-3" />
              Chat
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTopicInput(!showTopicInput)} title="Set topic">
              <Tag className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditName(contact.name); setEditing(true) }}>
              <Pencil className="h-3 w-3" />
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <Button variant="destructive" size="sm" className="h-8 text-[10px]" onClick={handleDelete}>
                  Delete
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-[10px]" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
      {showTopicInput && (
        <div className="border-t border-border/50 px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Tag className="h-3 w-3" />
            <span className="font-mono uppercase tracking-wider">Room Topic (optional)</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Contract negotiation, API design..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-8 text-xs"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleChat()}
            />
            <Button size="sm" className="h-8 text-xs shrink-0" onClick={handleChat}>
              Go
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

export function ContactList() {
  const contacts = useContactStore((s) => s.contacts)
  const presenceContacts = useMemo(
    () => contacts.map((c) => ({ id: c.id, sharedSecret: c.sharedSecret })),
    [contacts]
  )
  const online = usePresence(presenceContacts)

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No contacts yet</p>
        <p className="text-xs mt-1">Create a pairing to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} isOnline={online[contact.id]} />
      ))}
    </div>
  )
}
