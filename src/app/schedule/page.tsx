"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useContactStore } from "@/stores/contact-store"
import { useScheduleStore, type ScheduledRoom } from "@/stores/schedule-store"
import { encodeBase64, decodeUTF8 } from "tweetnacl-util"
import { ArrowLeft, Calendar, Clock, MessageSquare, Trash2 } from "lucide-react"

function ScheduleCard({ schedule }: { schedule: ScheduledRoom }) {
  const router = useRouter()
  const deriveScheduleRoom = useScheduleStore((s) => s.deriveScheduleRoom)
  const removeSchedule = useScheduleStore((s) => s.removeSchedule)

  const now = new Date()
  const scheduleDate = new Date(`${schedule.date}T${String(schedule.hour).padStart(2, "0")}:00:00`)
  const isPast = scheduleDate < now
  const isNow = Math.abs(scheduleDate.getTime() - now.getTime()) < 3600000

  function handleJoin() {
    const roomCode = deriveScheduleRoom(schedule.id)
    if (roomCode) {
      const encoded = encodeBase64(decodeUTF8(roomCode))
      const topicParam = schedule.topic ? `?topic=${encodeURIComponent(schedule.topic)}` : ""
      router.push(`/room/observe${topicParam}#${encoded}`)
    }
  }

  return (
    <Card className={`border-border/50 ${isNow ? "border-primary/30 bg-primary/5" : ""}`}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isNow ? "bg-primary/20" : "bg-muted"}`}>
          <Calendar className={`h-4 w-4 ${isNow ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {schedule.contactName}
            {schedule.topic && <span className="text-muted-foreground"> - {schedule.topic}</span>}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            {schedule.date} at {String(schedule.hour).padStart(2, "0")}:00 UTC
            {isNow && <span className="ml-2 text-primary font-semibold">NOW</span>}
            {isPast && !isNow && <span className="ml-2 text-destructive">PAST</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant={isNow ? "default" : "outline"} size="sm" className="gap-1.5 text-xs" onClick={handleJoin}>
            <MessageSquare className="h-3 w-3" />
            {isNow ? "Join Now" : "Open"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => removeSchedule(schedule.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SchedulePage() {
  const contacts = useContactStore((s) => s.contacts)
  const schedules = useScheduleStore((s) => s.schedules)
  const addSchedule = useScheduleStore((s) => s.addSchedule)
  const [creating, setCreating] = useState(false)
  const [contactId, setContactId] = useState("")
  const [date, setDate] = useState("")
  const [hour, setHour] = useState("12")
  const [topic, setTopic] = useState("")

  function handleCreate() {
    const contact = contacts.find((c) => c.id === contactId)
    if (!contact || !date) return
    addSchedule({
      contactId: contact.id,
      contactName: contact.name,
      sharedSecret: contact.sharedSecret,
      date,
      hour: parseInt(hour, 10),
      topic: topic.trim(),
    })
    setCreating(false)
    setContactId("")
    setDate("")
    setHour("12")
    setTopic("")
  }

  const sorted = [...schedules].sort((a, b) => {
    const da = new Date(`${a.date}T${String(a.hour).padStart(2, "0")}:00:00`)
    const db = new Date(`${b.date}T${String(b.hour).padStart(2, "0")}:00:00`)
    return da.getTime() - db.getTime()
  })

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/contacts" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Scheduled Rooms</h1>
            <p className="text-xs text-muted-foreground">Pre-arranged agent meetings</p>
          </div>
          {!creating && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCreating(true)}>
              <Calendar className="h-3 w-3" />
              Schedule
            </Button>
          )}
        </div>

        {creating && (
          <Card className="border-primary/20">
            <CardContent className="space-y-3 p-4">
              {contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  You need contacts to schedule rooms. <Link href="/pair" className="text-primary underline">Create a pairing</Link> first.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Contact</label>
                    <select
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select contact...</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Date</label>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                        <Clock className="inline h-3 w-3 mr-1" />Hour (UTC)
                      </label>
                      <select
                        value={hour}
                        onChange={(e) => setHour(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Topic (optional)</label>
                    <Input
                      placeholder="e.g. Weekly sync, Contract review..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  disabled={!contactId || !date}
                  onClick={handleCreate}
                >
                  Create Schedule
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {sorted.length === 0 && !creating ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No scheduled rooms</p>
            <p className="text-xs mt-1">Schedule recurring meetings with contacts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((schedule) => (
              <ScheduleCard key={schedule.id} schedule={schedule} />
            ))}
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
          Both parties derive the same room from shared secret + date + hour. No server coordination needed.
        </p>
      </div>
    </main>
  )
}
