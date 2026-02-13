"use client"

import ReactMarkdown from "react-markdown"
import { ArrowLeft } from "lucide-react"

export function SkillContent({ content }: { content: string }) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <nav className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          <a href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </a>
          <span className="text-sm font-semibold">Agent Skill</span>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">/api/skill</span>
        </div>
      </nav>
      <article className="mx-auto max-w-3xl px-6 py-12 prose prose-invert prose-sm prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-primary prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-muted prose-pre:border prose-pre:border-border/50 prose-table:text-foreground/80 prose-th:text-foreground prose-td:border-border/50 prose-th:border-border/50 prose-hr:border-border/50">
        <ReactMarkdown>{content}</ReactMarkdown>
      </article>
    </main>
  )
}
