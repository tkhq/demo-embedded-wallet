// Mainnet spot prices used ONLY to give testnet balances a realistic USD value
// for demonstration — testnet assets have no market price of their own. Prices
// come from Coinbase's public, unauthenticated spot endpoint (no API key, no
// backend); stablecoins are pinned to $1. Keeping the source here means it can
// be swapped in one place without touching the wallet provider or UI.

import { CHAINS, ChainKey, isNativeAsset } from "@/config/networks"

import { AssetBalance } from "@/types/turnkey"

// symbol (uppercase) → USD per whole unit
export type PriceMap = Record<string, number>

const spotUrl = (pair: string) =>
  `https://api.coinbase.com/v2/prices/${pair}/spot`

// Assets priced from Coinbase (native ETH / SOL).
const COINBASE_PAIRS: Record<string, string> = {
  ETH: "ETH-USD",
  SOL: "SOL-USD",
}

// Stablecoins pinned rather than fetched.
const PINNED: PriceMap = { USDC: 1 }

async function fetchSpot(pair: string): Promise<number | undefined> {
  try {
    const res = await fetch(spotUrl(pair))
    if (!res.ok) return undefined
    const json = (await res.json()) as { data?: { amount?: string } }
    const amount = Number(json.data?.amount)
    return Number.isFinite(amount) && amount > 0 ? amount : undefined
  } catch {
    return undefined
  }
}

/**
 * Fetch mainnet spot prices for the assets the demo shows, as a symbol→USD map
 * (e.g. `{ ETH, SOL, USDC: 1 }`). Any source that fails is simply omitted, so
 * the caller treats a missing symbol as "no USD" — this never throws.
 */
export async function fetchMainnetPrices(): Promise<PriceMap> {
  const entries = Object.entries(COINBASE_PAIRS)
  const results = await Promise.all(entries.map(([, pair]) => fetchSpot(pair)))
  const prices: PriceMap = { ...PINNED }
  entries.forEach(([symbol], i) => {
    const price = results[i]
    if (price !== undefined) prices[symbol] = price
  })
  return prices
}

/**
 * Overlay a mainnet-equivalent USD value onto a chain's testnet balances for
 * demonstration. Turnkey returns the real balance amounts; testnet assets have
 * no market price, so we compute `display.usd` (and `display.crypto`, so a
 * per-unit price is derivable) from the mainnet spot price of the matching
 * symbol. Balances whose symbol we don't price are passed through unchanged
 * (their USD stays hidden). This is demo-only — testnet holdings are worthless.
 */
export function withMainnetEquivalentUsd(
  chainKey: ChainKey,
  balances: AssetBalance[],
  prices: PriceMap
): AssetBalance[] {
  const chain = CHAINS[chainKey]
  return balances.map((balance) => {
    const native = isNativeAsset(chainKey, balance)
    const symbol = native ? chain.nativeSymbol : balance.symbol
    const decimals = native ? chain.nativeDecimals : balance.decimals
    const price = symbol ? prices[symbol.toUpperCase()] : undefined
    if (
      price === undefined ||
      balance.balance === undefined ||
      decimals === undefined
    ) {
      return balance
    }
    const amount = Number(balance.balance) / 10 ** decimals
    if (!Number.isFinite(amount)) return balance
    return {
      ...balance,
      display: {
        ...balance.display,
        usd: (amount * price).toString(),
        crypto: amount.toString(),
      },
    }
  })
}
