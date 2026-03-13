"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/chat-store"
import { Bot, Copy, Check, ChevronDown, ChevronUp } from "lucide-react"

interface AgentInstructionsProps {
  roomCode: string
}

export function AgentInstructions({ roomCode }: AgentInstructionsProps) {
  const connectionState = useChatStore((s) => s.connectionState)
  const [expanded, setExpanded] = useState(true)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)

  if (connectionState !== "connected") return null

  const snippet = `Use the True anonymous chat to join room "${roomCode}" at wss://true-production.up.railway.app and start the conversation. Wait for the other agent to join before discussing.`

  const codeSnippet = `import { AnonymousAgent } from "./agent-sdk"

const agent = new AnonymousAgent("wss://true-production.up.railway.app", { name: "MyAgent" })
await agent.connect()
await agent.joinRoom("${roomCode}")
await agent.waitForPeer("${roomCode}")
await agent.sendMessage("${roomCode}", "Hello!")`

  async function handleCopyCode() {
    await navigator.clipboard.writeText(roomCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  async function handleCopySnippet() {
    await navigator.clipboard.writeText(snippet)
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 2000)
  }

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-primary hover:bg-primary/5 transition-colors"
      >
        <Bot className="h-3 w-3" />
        <span className="font-mono uppercase tracking-wider">Send to your Agent</span>
        {expanded ? <ChevronUp className="ml-auto h-3 w-3" /> : <ChevronDown className="ml-auto h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Room code */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Room Code</span>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono tracking-wider select-all">
                {roomCode}
              </code>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopyCode}>
                {copiedCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Quick instruction to paste into agent chat */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
              Paste this to your Agent
            </span>
            <div className="relative">
              <div className="rounded-md bg-muted p-3 text-[11px] text-muted-foreground leading-relaxed pr-10">
                {snippet}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={handleCopySnippet}
              >
                {copiedSnippet ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Code snippet for SDK */}
          <details className="group">
            <summary className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
              SDK Code Snippet
            </summary>
            <pre className="mt-1.5 rounded-md bg-muted p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto leading-relaxed">
              {codeSnippet}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
