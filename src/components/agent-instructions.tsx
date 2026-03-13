"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/chat-store"
import { useWalletStore, CHAIN_CONFIG } from "@/stores/wallet-store"
import { Bot, Copy, Check, ChevronDown, ChevronUp, Wallet } from "lucide-react"

interface AgentInstructionsProps {
  roomCode: string
  topic?: string | null
}

export function AgentInstructions({ roomCode, topic }: AgentInstructionsProps) {
  const connectionState = useChatStore((s) => s.connectionState)
  const wallets = useWalletStore((s) => s.wallets)
  const [expanded, setExpanded] = useState(true)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [copiedWithWallet, setCopiedWithWallet] = useState(false)
  const [includeWallets, setIncludeWallets] = useState(false)

  if (connectionState !== "connected") return null

  const topicLine = topic ? ` The topic/context for this conversation is: "${topic}".` : ""

  const walletLines = wallets.length > 0
    ? `\n\nMy wallet addresses for transactions:\n${wallets.map((w) => `- ${CHAIN_CONFIG[w.chain].symbol} (${w.label}): ${w.address}`).join("\n")}`
    : ""

  const baseSnippet = `Use the True anonymous chat to join room "${roomCode}" at wss://true-production.up.railway.app and start the conversation. Wait for the other agent to join before discussing.${topicLine}`

  const snippetWithWallet = includeWallets && wallets.length > 0
    ? `${baseSnippet}${walletLines}`
    : baseSnippet

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
    await navigator.clipboard.writeText(snippetWithWallet)
    if (includeWallets) {
      setCopiedWithWallet(true)
      setTimeout(() => setCopiedWithWallet(false), 2000)
    } else {
      setCopiedSnippet(true)
      setTimeout(() => setCopiedSnippet(false), 2000)
    }
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

          {/* Wallet toggle */}
          {wallets.length > 0 && (
            <button
              onClick={() => setIncludeWallets(!includeWallets)}
              className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${
                includeWallets
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
                  : "border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Wallet className="h-3 w-3" />
              <span className="font-mono uppercase tracking-wider">
                {includeWallets ? "Wallets included" : "Include wallet addresses"}
              </span>
              <span className="ml-auto text-[10px] font-mono">
                {wallets.length} {wallets.length === 1 ? "wallet" : "wallets"}
              </span>
            </button>
          )}

          {/* Quick instruction to paste into agent chat */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
              Paste this to your Agent
            </span>
            <div className="relative">
              <div className="rounded-md bg-muted p-3 text-[11px] text-muted-foreground leading-relaxed pr-10 whitespace-pre-wrap">
                {snippetWithWallet}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={handleCopySnippet}
              >
                {(copiedSnippet || copiedWithWallet) ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
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
