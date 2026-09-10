import { Account, AssetBalance, Wallet } from "@/types/turnkey"

// Network mode toggled globally from the dashboard. Testnet is the default so
// real-fund mainnet sends are always an explicit opt-in.
export type NetworkMode = "mainnet" | "testnet"

// The chains the Default Wallet spans. Keyed by a stable app-level id. Note that
// all EVM chains (ethereum, base, …) share one secp256k1 account/address; Solana
// has its own. Adding another EVM chain is a new entry here — the same account
// serves it.
export type ChainKey = "ethereum" | "base" | "solana"

// Turnkey wallet-account address formats we create + recognize.
export type SupportedAddressFormat =
  | "ADDRESS_FORMAT_ETHEREUM"
  | "ADDRESS_FORMAT_SOLANA"

// CAIP-2 identifiers we pass to Turnkey's Balances / transaction APIs. Kept as
// per-chain literal types (subsets of the SDK's accepted values) so they assign
// cleanly to `handleSendTransaction`'s chain-specific `caip2` fields — the SDK
// types the EVM and Solana transaction intents with disjoint `caip2` unions.
export type EvmCaip2 =
  | "eip155:1"
  | "eip155:11155111"
  | "eip155:8453"
  | "eip155:84532"
export type SolanaCaip2 =
  | "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
  | "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
export type Caip2 = EvmCaip2 | SolanaCaip2

type Caip2ForChain<K extends ChainKey> = K extends "solana"
  ? SolanaCaip2
  : EvmCaip2

interface ChainConfig {
  key: ChainKey
  addressFormat: SupportedAddressFormat
  label: string
  // Symbol of the chain's native asset (used to match Balances API entries).
  nativeSymbol: string
  // Key into the `Icons` map (src/components/icons.tsx).
  iconKey: "ethereum" | "base" | "solana"
  // Human-readable name of the testnet, e.g. "Sepolia" / "Devnet".
  testnetName: string
  // CAIP-2 chain identifiers passed to Turnkey's Balances / transaction APIs.
  caip2: Record<NetworkMode, Caip2>
  // CAIP-19 asset-id suffix identifying the native asset (slip44 coin type).
  nativeSlip44: string
  // Decimals of the native asset (wei: 18, lamports: 9).
  nativeDecimals: number
  // CAIP-19 asset-namespace used for fungible tokens on this chain.
  tokenNamespace: "erc20" | "token"
}

export const CHAINS: Record<ChainKey, ChainConfig> = {
  ethereum: {
    key: "ethereum",
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
    label: "Ethereum",
    nativeSymbol: "ETH",
    iconKey: "ethereum",
    testnetName: "Sepolia",
    caip2: {
      mainnet: "eip155:1",
      testnet: "eip155:11155111",
    },
    nativeSlip44: "slip44:60",
    nativeDecimals: 18,
    tokenNamespace: "erc20",
  },
  base: {
    key: "base",
    // Same secp256k1 account/address as Ethereum — Base is just another EVM chain.
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
    label: "Base",
    nativeSymbol: "ETH",
    iconKey: "base",
    testnetName: "Sepolia",
    caip2: {
      mainnet: "eip155:8453",
      testnet: "eip155:84532",
    },
    nativeSlip44: "slip44:60",
    nativeDecimals: 18,
    tokenNamespace: "erc20",
  },
  solana: {
    key: "solana",
    addressFormat: "ADDRESS_FORMAT_SOLANA",
    label: "Solana",
    nativeSymbol: "SOL",
    iconKey: "solana",
    testnetName: "Devnet",
    caip2: {
      // Canonical CAIP-2 genesis-hash identifiers (Turnkey also accepts the
      // `solana:mainnet` / `solana:devnet` aliases).
      mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      testnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    },
    nativeSlip44: "slip44:501",
    nativeDecimals: 9,
    tokenNamespace: "token",
  },
}

export const CHAIN_LIST: ChainConfig[] = Object.values(CHAINS)

// True for EVM chains (Ethereum, Base, …). Used to pick the send/validation path.
export const isEvmChain = (chainKey: ChainKey): boolean =>
  CHAINS[chainKey].addressFormat === "ADDRESS_FORMAT_ETHEREUM"

// Account-level derivation index parsed from the BIP-44 path (the segment after
// the coin type): m/44'/60'/N'/0/0 (ETH), m/44'/501'/N'/0' (SOL). A wallet's
// ETH + SOL accounts at the same N are one logical "account" (a Phantom-style
// HD index).
export const accountIndex = (account: { path?: string }): number => {
  const seg = account.path?.split("/")[3]
  const n = seg ? parseInt(seg.replace(/'$/, ""), 10) : 0
  return Number.isNaN(n) ? 0 : n
}

// Sorted, de-duplicated account indexes in a wallet (each = one ETH+SOL pair).
export const walletAccountIndexes = (wallet: Wallet | null): number[] => {
  if (!wallet) return []
  return [...new Set(wallet.accounts.map(accountIndex))].sort((a, b) => a - b)
}

// Sort comparator: oldest wallet first (the Default Wallet created at sign-up
// leads). createdAt is a { seconds, nanos } timestamp.
export const byWalletCreation = (a: Wallet, b: Wallet): number =>
  Number(a.createdAt?.seconds ?? 0) - Number(b.createdAt?.seconds ?? 0) ||
  Number(a.createdAt?.nanos ?? 0) - Number(b.createdAt?.nanos ?? 0)

// The wallet account that serves a chain at a given derivation index — matching
// both the chain's address format and the index. One EVM account serves every
// EVM chain; the Solana account serves Solana.
export const accountForChain = (
  wallet: Wallet | null,
  chainKey: ChainKey,
  index: number
): Account | undefined =>
  wallet?.accounts.find(
    (a) =>
      a.addressFormat === CHAINS[chainKey].addressFormat &&
      accountIndex(a) === index
  )

// CAIP-2 identifier for a chain in the active network mode. Generic so a literal
// chain key ("ethereum" / "solana") yields the chain-specific CAIP-2 union.
export const caip2For = <K extends ChainKey>(
  chainKey: K,
  mode: NetworkMode
): Caip2ForChain<K> =>
  CHAINS[chainKey].caip2[mode] as Caip2ForChain<K>

// True when an asset balance is the chain's native asset (ETH / SOL), matched
// by CAIP-19 slip44 suffix with a symbol fallback.
export const isNativeAsset = (
  chainKey: ChainKey,
  balance: AssetBalance
): boolean => {
  const chain = CHAINS[chainKey]
  return (
    balance.caip19?.endsWith(chain.nativeSlip44) ||
    balance.symbol === chain.nativeSymbol
  )
}

// Token contract (ERC-20) / mint (SPL) parsed from a CAIP-19 asset id, or
// undefined for the native asset (or an unparseable/foreign id). CAIP-19 looks
// like `<caip2>/<namespace>:<reference>`, e.g. `eip155:1/erc20:0xA0b8…` or
// `solana:5eykt…/token:EPjF…`.
export const tokenContractOf = (
  chainKey: ChainKey,
  caip19: string | undefined
): string | undefined => {
  if (!caip19) return undefined
  const assetPart = caip19.split("/")[1]
  if (!assetPart) return undefined
  const [namespace, reference] = assetPart.split(":")
  if (namespace !== CHAINS[chainKey].tokenNamespace || !reference) {
    return undefined
  }
  return reference
}

// Label for a chain in the active mode, e.g. "Ethereum (Sepolia)" / "Solana".
export const networkLabel = (chainKey: ChainKey, mode: NetworkMode): string => {
  const chain = CHAINS[chainKey]
  return mode === "testnet"
    ? `${chain.label} (${chain.testnetName})`
    : chain.label
}

// Display-only USD value of a single asset balance (0 when absent/unparseable).
// Per Turnkey, `display.usd` is for presentation only — fine for a demo total.
export const usdOf = (balance: AssetBalance): number => {
  const usd = parseFloat(balance.display?.usd ?? "")
  return Number.isNaN(usd) ? 0 : usd
}

// Sum of the display-only USD values across a list of asset balances.
export const sumUsd = (balances: AssetBalance[]): number =>
  balances.reduce((total, b) => total + usdOf(b), 0)

// Display-only USD price per whole unit, derived from Turnkey's `display` fields
// (usd / crypto). Undefined when unavailable (e.g. testnet, where usd is 0).
export const unitPriceOf = (balance: AssetBalance): number | undefined => {
  const usd = Number(balance.display?.usd)
  const crypto = Number(balance.display?.crypto)
  if (!crypto || Number.isNaN(usd) || Number.isNaN(crypto)) return undefined
  return usd / crypto
}
