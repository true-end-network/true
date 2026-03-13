import { create } from "zustand"
import { persist } from "zustand/middleware"
import { generatePeerId } from "@/lib/crypto"

export type Chain = "bitcoin" | "ethereum" | "solana" | "hyperliquid" | "liquid-bitcoin" | "depix"

export const CHAIN_CONFIG: Record<Chain, { label: string; symbol: string; color: string; placeholder: string }> = {
  bitcoin: { label: "Bitcoin", symbol: "BTC", color: "#f7931a", placeholder: "bc1q... or 1... or 3..." },
  ethereum: { label: "Ethereum", symbol: "ETH", color: "#627eea", placeholder: "0x..." },
  solana: { label: "Solana", symbol: "SOL", color: "#9945ff", placeholder: "Base58 address..." },
  hyperliquid: { label: "Hyperliquid", symbol: "HL", color: "#00d4aa", placeholder: "0x..." },
  "liquid-bitcoin": { label: "Liquid Bitcoin", symbol: "L-BTC", color: "#009dff", placeholder: "ex1q... or VJL..." },
  depix: { label: "Depix", symbol: "DEPIX", color: "#00c853", placeholder: "Depix address..." },
}

export const CHAINS: Chain[] = ["bitcoin", "ethereum", "solana", "hyperliquid", "liquid-bitcoin", "depix"]

export interface Wallet {
  id: string
  chain: Chain
  address: string
  label: string
  createdAt: number
}

interface WalletStore {
  wallets: Wallet[]
  addWallet: (chain: Chain, address: string, label: string) => Wallet
  removeWallet: (id: string) => void
  updateWallet: (id: string, address: string, label: string) => void
  getWalletsByChain: (chain: Chain) => Wallet[]
  getShareableText: () => string
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      wallets: [],

      addWallet: (chain: Chain, address: string, label: string) => {
        const wallet: Wallet = {
          id: generatePeerId(),
          chain,
          address: address.trim(),
          label: label.trim() || CHAIN_CONFIG[chain].label,
          createdAt: Date.now(),
        }
        set((s) => ({ wallets: [...s.wallets, wallet] }))
        return wallet
      },

      removeWallet: (id: string) => {
        set((s) => ({ wallets: s.wallets.filter((w) => w.id !== id) }))
      },

      updateWallet: (id: string, address: string, label: string) => {
        set((s) => ({
          wallets: s.wallets.map((w) =>
            w.id === id ? { ...w, address: address.trim(), label: label.trim() } : w
          ),
        }))
      },

      getWalletsByChain: (chain: Chain) => {
        return get().wallets.filter((w) => w.chain === chain)
      },

      getShareableText: () => {
        const wallets = get().wallets
        if (wallets.length === 0) return ""
        const lines = wallets.map(
          (w) => `${CHAIN_CONFIG[w.chain].symbol} (${w.label}): ${w.address}`
        )
        return `My wallet addresses:\n${lines.join("\n")}`
      },
    }),
    {
      name: "true-wallets",
    }
  )
)
