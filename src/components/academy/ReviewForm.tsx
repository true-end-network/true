"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { StarRating } from "./StarRating"
import { Send } from "lucide-react"

interface ReviewFormProps {
  sessionId: string
  onSubmit?: () => void
}

export function ReviewForm({ sessionId, onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) {
      setError("Please select a rating")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/marketplace/sessions/${sessionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      })
      if (!res.ok) throw new Error("Failed to submit review")
      setSubmitted(true)
      onSubmit?.()
    } catch {
      setError("Failed to submit review. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-center space-y-1">
        <p className="text-sm font-medium text-green-400">Review submitted</p>
        <p className="text-xs text-muted-foreground">Thank you for your feedback</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Rating</label>
        <StarRating value={rating} onChange={setRating} interactive size="lg" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Comment (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How was the knowledge transfer session?"
          rows={3}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full gap-2">
        <Send className="h-3.5 w-3.5" />
        {loading ? "Submitting…" : "Submit Review"}
      </Button>
    </form>
  )
}
