"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  useWalletStore,
  CHAINS,
  CHAIN_CONFIG,
  type Chain,
  type Wallet,
} from "@/stores/wallet-store"
import { ArrowLeft, Plus, Trash2, Copy, Check, Pencil, X, Wallet as WalletIcon } from "lucide-react"

function WalletCard({ wallet }: { wallet: Wallet }) {
  const removeWallet = useWalletStore((s) => s.removeWallet)
  const updateWallet = useWalletStore((s) => s.updateWallet)
  const [editing, setEditing] = useState(false)
  const [editAddress, setEditAddress] = useState(wallet.address)
  const [editLabel, setEditLabel] = useState(wallet.label)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const config = CHAIN_CONFIG[wallet.chain]

  async function handleCopy() {
    await navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSave() {
    if (editAddress.trim()) {
      updateWallet(wallet.id, editAddress, editLabel)
    }
    setEditing(false)
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: config.color }}
          >
            {config.symbol.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="h-7 text-xs"
                placeholder="Label"
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{wallet.label}</span>
                <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                  {config.symbol}
                </span>
              </div>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditAddress(wallet.address); setEditLabel(wallet.label); setEditing(true) }}>
                <Pencil className="h-3 w-3" />
              </Button>
              {confirmDelete ? (
                <div className="flex items-center gap-1">
                  <Button variant="destructive" size="sm" className="h-7 text-[10px]" onClick={() => removeWallet(wallet.id)}>
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setConfirmDelete(false)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder={config.placeholder}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={handleSave}>Save</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] font-mono text-muted-foreground break-all select-all leading-relaxed">
            {wallet.address}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function AddWalletForm({ onDone }: { onDone: () => void }) {
  const addWallet = useWalletStore((s) => s.addWallet)
  const [chain, setChain] = useState<Chain>("bitcoin")
  const [address, setAddress] = useState("")
  const [label, setLabel] = useState("")

  function handleAdd() {
    if (address.trim()) {
      addWallet(chain, address, label)
      setAddress("")
      setLabel("")
      onDone()
    }
  }

  const config = CHAIN_CONFIG[chain]

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Chain</label>
          <div className="grid grid-cols-3 gap-1.5">
            {CHAINS.map((c) => {
              const cfg = CHAIN_CONFIG[c]
              return (
                <button
                  key={c}
                  onClick={() => setChain(c)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    chain === c
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border/50 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="truncate">{cfg.symbol}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Address</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={config.placeholder}
            className="text-xs font-mono"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Label (optional)</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`e.g. Main ${config.label} wallet`}
            className="text-xs"
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1 text-xs" disabled={!address.trim()} onClick={handleAdd}>
            Add Wallet
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function WalletPage() {
  const wallets = useWalletStore((s) => s.wallets)
  const getShareableText = useWalletStore((s) => s.getShareableText)
  const [adding, setAdding] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  async function handleCopyAll() {
    const text = getShareableText()
    if (text) {
      await navigator.clipboard.writeText(text)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-12 pt-[calc(3rem+env(safe-area-inset-top))]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Wallets</h1>
            <p className="text-xs text-muted-foreground">Your crypto addresses for secure transactions</p>
          </div>
          {!adding && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setAdding(true)}>
              <Plus className="h-3 w-3" />
              Add
            </Button>
          )}
        </div>

        {adding && <AddWalletForm onDone={() => setAdding(false)} />}

        {wallets.length === 0 && !adding ? (
          <div className="text-center py-12 text-muted-foreground">
            <WalletIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No wallets yet</p>
            <p className="text-xs mt-1">Add your crypto addresses to share securely in rooms</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <WalletCard key={wallet.id} wallet={wallet} />
              ))}
            </div>

            {wallets.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={handleCopyAll}
              >
                {copiedAll ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedAll ? "Copied!" : "Copy All Addresses"}
              </Button>
            )}
          </>
        )}

        <div className="space-y-2">
          <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
            Wallets are stored locally in your browser. The server never sees them.
          </p>
          <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
            Share addresses with agents through encrypted room instructions.
          </p>
        </div>
      </div>
    </main>
  )
}
