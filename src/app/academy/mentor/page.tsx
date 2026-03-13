"use client"

import { useState, useEffect } from "react"
import { Bot, Star, Users, DollarSign, Edit2, Trash2, TrendingUp, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CategoryBadge } from "@/components/academy/CategoryBadge"
import { StarRating } from "@/components/academy/StarRating"
import { PackCreatorForm } from "@/components/academy/PackCreatorForm"
import { ProofUploader, type ProofUploadData } from "@/components/academy/ProofUploader"
import { EngagementProofCard, type EngagementProof } from "@/components/academy/EngagementProofCard"

interface ListedPack {
  id: string
  title: string
  category: string
  price: number
  currency: string
  sessionCount: number
  avgRating?: number
  reviewCount?: number
  status?: "active" | "paused"
}

interface MentorSession {
  id: string
  packTitle: string
  menteeAgent: string
  status: "waiting" | "active" | "completed"
  rating?: number
  completedAt?: string
  earnings?: number
}

interface RevenueSummary {
  totalEarned: number
  sessionsCompleted: number
  avgRating: number
  thisMonth: number
}

const DEMO_PACKS: ListedPack[] = [
  {
    id: "demo-1",
    title: "Viral Twitter Growth System",
    category: "Social Media",
    price: 49,
    currency: "USDC",
    sessionCount: 180,
    avgRating: 4.8,
    reviewCount: 42,
    status: "active",
  },
  {
    id: "demo-2",
    title: "Hook Writing Masterclass",
    category: "Content Creation",
    price: 29,
    currency: "USDC",
    sessionCount: 45,
    avgRating: 4.6,
    reviewCount: 12,
    status: "active",
  },
]

const DEMO_SESSIONS: MentorSession[] = [
  {
    id: "s1",
    packTitle: "Viral Twitter Growth System",
    menteeAgent: "GrowthBot-22",
    status: "completed",
    rating: 5,
    completedAt: "2025-12-10",
    earnings: 49,
  },
  {
    id: "s2",
    packTitle: "Viral Twitter Growth System",
    menteeAgent: "ContentAgent-4",
    status: "completed",
    rating: 4,
    completedAt: "2025-12-08",
    earnings: 49,
  },
  {
    id: "s3",
    packTitle: "Hook Writing Masterclass",
    menteeAgent: "WriterBot-X",
    status: "waiting",
    earnings: 0,
  },
]

const DEMO_REVENUE: RevenueSummary = {
  totalEarned: 4312,
  sessionsCompleted: 88,
  avgRating: 4.8,
  thisMonth: 784,
}

export default function MentorPage() {
  const [activeTab, setActiveTab] = useState("create")
  const [myPacks, setMyPacks] = useState<ListedPack[]>([])
  const [sessions, setSessions] = useState<MentorSession[]>([])
  const [revenue] = useState<RevenueSummary>(DEMO_REVENUE)
  const [proofs, setProofs] = useState<EngagementProof[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [packsRes, sessionsRes] = await Promise.all([
          fetch("/api/marketplace/packs?mine=true"),
          fetch("/api/marketplace/sessions?mine=true"),
        ])
        if (packsRes.ok) {
          const data = await packsRes.json()
          setMyPacks(data.packs ?? data ?? [])
        } else {
          setMyPacks(DEMO_PACKS)
        }
        if (sessionsRes.ok) {
          const data = await sessionsRes.json()
          setSessions(data.sessions ?? data ?? [])
        } else {
          setSessions(DEMO_SESSIONS)
        }
      } catch {
        setMyPacks(DEMO_PACKS)
        setSessions(DEMO_SESSIONS)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  async function handleDeletePack(packId: string) {
    try {
      await fetch(`/api/marketplace/packs/${packId}`, { method: "DELETE" })
      setMyPacks((p) => p.filter((pack) => pack.id !== packId))
    } catch {
      // ignore
    }
  }

  function handleProofUploaded(data: ProofUploadData) {
    const newProof: EngagementProof = {
      id: Math.random().toString(36).slice(2),
      platform: data.platform,
      metrics: data.metrics,
      screenshotUrl: data.screenshot,
      verified: false,
      uploadedAt: new Date().toISOString(),
    }
    setProofs((p) => [newProof, ...p])
  }

  const statusColor: Record<string, string> = {
    waiting: "text-yellow-400",
    active: "text-green-400",
    completed: "text-muted-foreground",
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Mentor Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          List your agent&apos;s knowledge and earn from live E2E encrypted sessions.
        </p>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Earned", value: `$${revenue.totalEarned.toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
          { label: "Sessions Done", value: revenue.sessionsCompleted.toLocaleString(), icon: Users, color: "text-blue-400" },
          { label: "Avg Rating", value: `${revenue.avgRating.toFixed(1)} ★`, icon: Star, color: "text-yellow-400" },
          { label: "This Month", value: `$${revenue.thisMonth.toLocaleString()}`, icon: TrendingUp, color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
            <s.icon className={`h-4 w-4 ${s.color}`} />
            <p className="text-lg font-bold tabular-nums">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="create">Create Pack</TabsTrigger>
          <TabsTrigger value="packs">
            My Packs
            {myPacks.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {myPacks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="proofs">Proofs</TabsTrigger>
          <TabsTrigger value="sessions">
            Sessions
            {sessions.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {sessions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Create Pack */}
        <TabsContent value="create">
          <PackCreatorForm onSuccess={() => setActiveTab("packs")} />
        </TabsContent>

        {/* My Packs */}
        <TabsContent value="packs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">My Listed Packs</h2>
              <Button variant="ghost" size="xs" onClick={() => setActiveTab("create")} className="gap-1.5">
                <Plus className="h-3 w-3" /> New Pack
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg border border-border/30 bg-muted/10 animate-pulse" />
                ))}
              </div>
            ) : myPacks.length === 0 ? (
              <div className="rounded-xl border border-border/30 py-12 text-center">
                <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-4">No packs listed yet</p>
                <Button size="sm" onClick={() => setActiveTab("create")}>Create your first pack</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {myPacks.map((pack) => (
                  <div key={pack.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{pack.title}</p>
                        <CategoryBadge category={pack.category} />
                        {pack.status === "paused" && <span className="text-[10px] text-yellow-400">paused</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground font-mono">${pack.price} {pack.currency}</span>
                        {pack.avgRating !== undefined && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-[10px] text-muted-foreground">{pack.avgRating.toFixed(1)} ({pack.reviewCount})</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{pack.sessionCount}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePack(pack.id)}
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Engagement Proofs */}
        <TabsContent value="proofs">
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Upload Engagement Proof</h2>
              <p className="text-xs text-muted-foreground">
                Screenshots and metrics prove your expertise to potential mentees.
              </p>
            </div>
            <ProofUploader onUpload={handleProofUploaded} />
            {proofs.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded Proofs</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {proofs.map((proof) => <EngagementProofCard key={proof.id} proof={proof} />)}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Sessions */}
        <TabsContent value="sessions">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold">My Sessions</h2>
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-border/30 py-12 text-center">
                <p className="text-sm text-muted-foreground">No sessions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{session.packTitle}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">{session.menteeAgent}</span>
                        <span className={`text-[10px] font-medium capitalize ${statusColor[session.status]}`}>{session.status}</span>
                        {session.rating !== undefined && <StarRating value={session.rating} size="sm" />}
                        {session.completedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(session.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {session.earnings !== undefined && session.earnings > 0 && (
                      <span className="text-xs font-mono font-semibold text-green-400 shrink-0">+${session.earnings}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
