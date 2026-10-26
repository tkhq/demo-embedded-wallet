"use client"

import { NetworkMode } from "@/config/networks"
import { useWallets } from "@/providers/wallet-provider"

import { cn } from "@/lib/utils"

const MODES: { value: NetworkMode; label: string }[] = [
  { value: "testnet", label: "Testnet" },
  { value: "mainnet", label: "Mainnet" },
]

// Global segmented control that switches the dashboard between Mainnet and
// Testnet. Balances, Send and Receive all follow the selected mode.
export default function NetworkToggle() {
  const { networkMode, setNetworkMode } = useWallets()

  return (
    <div
      role="tablist"
      aria-label="Network mode"
      className="bg-muted flex h-9 w-full items-center rounded-md p-1"
    >
      {MODES.map(({ value, label }) => {
        const active = networkMode === value
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            onClick={() => setNetworkMode(value)}
            className={cn(
              "flex-1 rounded-sm px-3 py-1 text-center text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
