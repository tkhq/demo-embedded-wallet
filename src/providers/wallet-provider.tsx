"use client"

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react"
import {
  accountForChain,
  byWalletCreation,
  caip2For,
  CHAIN_LIST,
  ChainKey,
  NetworkMode,
  walletAccountIndexes,
} from "@/config/networks"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { useLocalStorage } from "usehooks-ts"
import { getAddress, isAddress } from "viem"

import { Account, AssetBalance, Wallet } from "@/types/turnkey"
import { NETWORK_MODE_KEY } from "@/lib/constants"
import {
  fetchMainnetPrices,
  PriceMap,
  withMainnetEquivalentUsd,
} from "@/lib/prices"

interface WalletsState {
  loading: boolean
  error: string
  wallets: Wallet[]
  selectedWallet: Wallet | null
  // The selected HD account index (Phantom-style "Account N"). Each index is one
  // ETH+SOL pair; balances/assets/send target this index's addresses.
  selectedAccountIndex: number
  // Asset balances keyed by ChainKey for the active network mode + selected
  // account. One EVM account is queried per EVM chain (ethereum, base, …), so
  // balances are keyed by chain rather than by address.
  balancesByChain: Record<string, AssetBalance[]>
}

type Action =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_WALLETS"; payload: Wallet[] }
  | { type: "SET_SELECTED_WALLET"; payload: Wallet }
  | { type: "SET_SELECTED_ACCOUNT_INDEX"; payload: number }
  | { type: "SET_BALANCES"; payload: Record<string, AssetBalance[]> }
  | { type: "ADD_WALLET"; payload: Wallet }
  | { type: "ADD_ACCOUNT"; payload: Account }

const WalletsContext = createContext<
  | {
      state: WalletsState
      dispatch: React.Dispatch<Action>
      networkMode: NetworkMode
      setNetworkMode: (mode: NetworkMode) => void
      getBalances: (chainKey: ChainKey) => AssetBalance[]
      refreshBalances: () => Promise<void>
      newWallet: (walletName?: string) => Promise<void>
      newWalletAccount: () => Promise<void>
      selectWallet: (wallet: Wallet) => void
      // The account indexes present in the selected wallet (each = an ETH+SOL pair).
      accountIndexes: number[]
      selectedAccountIndex: number
      setSelectedAccountIndex: (index: number) => void
      // The EVM account at the selected index (for the avatar seed).
      selectedAccount: Account | undefined
    }
  | undefined
>(undefined)

function walletsReducer(state: WalletsState, action: Action): WalletsState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload }
    case "SET_ERROR":
      return { ...state, error: action.payload }
    case "SET_WALLETS":
      return { ...state, wallets: action.payload }
    case "SET_SELECTED_WALLET":
      return { ...state, selectedWallet: action.payload }
    case "SET_SELECTED_ACCOUNT_INDEX":
      return { ...state, selectedAccountIndex: action.payload }
    case "SET_BALANCES":
      return { ...state, balancesByChain: action.payload }
    case "ADD_WALLET":
      return { ...state, wallets: [...state.wallets, action.payload] }
    case "ADD_ACCOUNT":
      if (state.selectedWallet) {
        const updatedWallets = state.wallets.map((wallet) => {
          if (wallet.walletId === state.selectedWallet?.walletId) {
            // Check if the account already exists in the wallet
            const accountExists = wallet.accounts.some(
              (account) => account.address === action.payload.address
            )

            // If the account does not exist, add it to the wallet's accounts
            if (!accountExists) {
              return {
                ...wallet,
                accounts: [...wallet.accounts, action.payload],
              }
            }
          }
          return wallet
        })

        // Find the updated selected wallet
        const selectedWallet = updatedWallets.find(
          (wallet) => wallet.walletId === state.selectedWallet?.walletId
        )

        return {
          ...state,
          wallets: updatedWallets,
          selectedWallet: selectedWallet || state.selectedWallet,
        }
      }
      return state
    default:
      return state
  }
}

const initialState: WalletsState = {
  loading: false,
  error: "",
  wallets: [],
  selectedWallet: null,
  selectedAccountIndex: 0,
  balancesByChain: {},
}

export function WalletsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(walletsReducer, initialState)
  const {
    wallets: hookWallets,
    createWallet,
    createWalletAccounts,
    refreshWallets,
    user,
    session,
    httpClient,
  } = useTurnkey()

  const [networkMode, setNetworkMode] = useLocalStorage<NetworkMode>(
    NETWORK_MODE_KEY,
    "testnet"
  )
  const pendingSelectWalletIdRef = useRef<string | null>(null)
  // Set after "Add Account" so the newest index is selected once it appears.
  const pendingSelectNewestRef = useRef(false)
  // Wallet ids for which a Solana-account backfill has already been attempted,
  // so we don't retry on every render.
  const backfilledWalletIdsRef = useRef<Set<string>>(new Set())
  // Monotonic id so a slower in-flight balance fetch can't overwrite a newer one.
  const balanceRequestIdRef = useRef(0)
  // Cached mainnet spot prices used to value testnet balances for demonstration
  // (see fetchBalances). Short TTL so a session picks up price moves without
  // refetching on every balance refresh.
  const pricesRef = useRef<{ map: PriceMap; fetchedAt: number } | null>(null)

  const selectWallet = (wallet: Wallet) => {
    dispatch({ type: "SET_SELECTED_WALLET", payload: wallet })
    // Reset to the first account (index 0) when switching wallets.
    dispatch({ type: "SET_SELECTED_ACCOUNT_INDEX", payload: 0 })
  }

  const setSelectedAccountIndex = (index: number) => {
    dispatch({ type: "SET_SELECTED_ACCOUNT_INDEX", payload: index })
  }

  const getBalances = useCallback(
    (chainKey: ChainKey): AssetBalance[] =>
      state.balancesByChain[chainKey] ?? [],
    [state.balancesByChain]
  )

  // Fetch balances for every chain in the active network mode, via Turnkey's
  // Balances API (no RPC). Each chain is queried against the wallet account that
  // serves it — so one EVM account is queried once per EVM chain (ethereum, base).
  const fetchBalances = useCallback(
    async (wallet: Wallet | null, mode: NetworkMode, index: number) => {
      // Skip when there's no active session (e.g. during/after logout) — the
      // Balances API would reject with "No active session or token available".
      if (!wallet || !httpClient || !session?.organizationId) return

      const organizationId = session.organizationId
      const requestId = ++balanceRequestIdRef.current

      // On testnet, holdings have no market price, so value them at their
      // mainnet counterpart's price for demonstration (see src/lib/prices.ts).
      // Cached with a short TTL and fetched in parallel with the balances.
      const PRICE_TTL_MS = 60_000
      const pricesPromise: Promise<PriceMap | null> =
        mode === "testnet"
          ? (async () => {
              const cached = pricesRef.current
              if (cached && Date.now() - cached.fetchedAt < PRICE_TTL_MS) {
                return cached.map
              }
              const map = await fetchMainnetPrices()
              pricesRef.current = { map, fetchedAt: Date.now() }
              return map
            })()
          : Promise.resolve(null)

      const [entries, prices] = await Promise.all([
        Promise.all(
          CHAIN_LIST.map(async (chain) => {
            const account = accountForChain(wallet, chain.key, index)
            if (!account) return [chain.key, [] as AssetBalance[]] as const
            try {
              const { balances = [] } =
                await httpClient.getWalletAddressBalances({
                  organizationId,
                  address: account.address,
                  caip2: caip2For(chain.key, mode),
                })
              return [chain.key, balances as AssetBalance[]] as const
            } catch (error) {
              console.error(
                `Error fetching ${chain.key} balances for ${account.address}:`,
                error
              )
              return [chain.key, [] as AssetBalance[]] as const
            }
          })
        ),
        pricesPromise,
      ])

      // Ignore stale responses (a newer fetch has started meanwhile).
      if (requestId !== balanceRequestIdRef.current) return

      // Overlay the mainnet-equivalent USD value on testnet balances; mainnet
      // keeps Turnkey's real display values untouched.
      const pricedEntries = prices
        ? entries.map(
            ([key, balances]) =>
              [key, withMainnetEquivalentUsd(key, balances, prices)] as const
          )
        : entries

      dispatch({
        type: "SET_BALANCES",
        payload: Object.fromEntries(pricedEntries),
      })
    },
    [httpClient, session]
  )

  const refreshBalances = useCallback(
    () =>
      fetchBalances(
        state.selectedWallet,
        networkMode,
        state.selectedAccountIndex
      ),
    [fetchBalances, state.selectedWallet, networkMode, state.selectedAccountIndex]
  )

  // Re-fetch balances whenever the selected wallet, network mode, or selected
  // account index changes.
  useEffect(() => {
    fetchBalances(state.selectedWallet, networkMode, state.selectedAccountIndex)
  }, [
    state.selectedWallet,
    networkMode,
    state.selectedAccountIndex,
    fetchBalances,
  ])

  useEffect(() => {
    if (!session?.organizationId) {
      return
    }

    // Normalize accounts, keeping BOTH EVM (checksummed) and Solana (base58)
    // addresses. The old code filtered on viem `isAddress`, which silently
    // dropped Solana accounts.
    const normalizedWallets: Wallet[] = (hookWallets ?? []).map((wallet) => ({
      ...wallet,
      accounts: (wallet.accounts ?? [])
        .map((account: any) => {
          if (account.addressFormat === "ADDRESS_FORMAT_ETHEREUM") {
            return isAddress(account.address)
              ? { ...account, address: getAddress(account.address) }
              : null
          }
          if (account.addressFormat === "ADDRESS_FORMAT_SOLANA") {
            return { ...account }
          }
          return null
        })
        .filter((account): account is Account => account !== null),
    }))

    dispatch({ type: "SET_WALLETS", payload: normalizedWallets })

    if (normalizedWallets.length === 0) {
      // Clear selection if no wallets available
      return
    }

    // Keep the currently selected wallet in sync with the latest wallets data
    if (state.selectedWallet) {
      const updatedSelected = normalizedWallets.find(
        (w) => w.walletId === state.selectedWallet?.walletId
      )
      if (updatedSelected) {
        dispatch({ type: "SET_SELECTED_WALLET", payload: updatedSelected })
        // After "Add Account", select the newest (highest) index once it lands.
        if (pendingSelectNewestRef.current) {
          const idxs = walletAccountIndexes(updatedSelected)
          dispatch({
            type: "SET_SELECTED_ACCOUNT_INDEX",
            payload: idxs[idxs.length - 1] ?? 0,
          })
          pendingSelectNewestRef.current = false
        }
      }
    }

    // If a wallet has been requested for selection by id (a just-created
    // wallet), select it once it appears in the refreshed list.
    if (pendingSelectWalletIdRef.current) {
      const match = normalizedWallets.find(
        (w) => w.walletId === pendingSelectWalletIdRef.current
      )
      if (match) {
        selectWallet(match)
        pendingSelectWalletIdRef.current = null
        return
      }
    }

    // Nothing selected yet: open on the oldest (Default) wallet.
    if (!state.selectedWallet) {
      selectWallet([...normalizedWallets].sort(byWalletCreation)[0])
    }
  }, [hookWallets, user])

  // Backfill a Solana account for wallets created before multi-chain support.
  useEffect(() => {
    const wallet = state.selectedWallet
    if (!wallet || !createWalletAccounts) return
    if (backfilledWalletIdsRef.current.has(wallet.walletId)) return

    const hasEvm = wallet.accounts.some(
      (a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
    )
    const hasSolana = wallet.accounts.some(
      (a) => a.addressFormat === "ADDRESS_FORMAT_SOLANA"
    )
    if (!hasEvm || hasSolana) return

    backfilledWalletIdsRef.current.add(wallet.walletId)
    ;(async () => {
      try {
        await createWalletAccounts({
          walletId: wallet.walletId,
          accounts: ["ADDRESS_FORMAT_SOLANA"],
        })
        await refreshWallets()
      } catch (error) {
        console.error("Failed to backfill Solana account:", error)
        // Allow a retry on a later render if it failed.
        backfilledWalletIdsRef.current.delete(wallet.walletId)
      }
    })()
  }, [state.selectedWallet, createWalletAccounts, refreshWallets])

  // Add Account: mints the next HD index (a new ETH + SOL pair — the SDK
  // auto-advances the index to avoid duplicates). The newest index is selected
  // once the wallet refresh lands (see pendingSelectNewestRef above).
  const newWalletAccount = async () => {
    if (!state.selectedWallet) return
    dispatch({ type: "SET_LOADING", payload: true })
    try {
      await createWalletAccounts({
        walletId: state.selectedWallet.walletId,
        accounts: ["ADDRESS_FORMAT_ETHEREUM", "ADDRESS_FORMAT_SOLANA"],
      })
      pendingSelectNewestRef.current = true
      await refreshWallets()
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to create new wallet account",
      })
    } finally {
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }

  const newWallet = async (walletName?: string) => {
    dispatch({ type: "SET_LOADING", payload: true })
    try {
      const walletId = await createWallet({
        walletName: walletName || "New Wallet",
        accounts: ["ADDRESS_FORMAT_ETHEREUM", "ADDRESS_FORMAT_SOLANA"],
      })
      if (walletId) {
        // Optimistic selection by wallet id; actual wallet object will be selected after refresh
        pendingSelectWalletIdRef.current = walletId
      }
      await refreshWallets()
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to create new wallet" })
    } finally {
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }

  const accountIndexes = walletAccountIndexes(state.selectedWallet)
  // The EVM account at the selected index (Solana as a fallback) — used for the
  // avatar seed. Per-chain resolution elsewhere goes through accountForChain.
  const selectedAccount =
    accountForChain(
      state.selectedWallet,
      "ethereum",
      state.selectedAccountIndex
    ) ??
    accountForChain(state.selectedWallet, "solana", state.selectedAccountIndex)

  const value = {
    state,
    dispatch,
    networkMode,
    setNetworkMode,
    getBalances,
    refreshBalances,
    newWallet,
    newWalletAccount,
    selectWallet,
    accountIndexes,
    selectedAccountIndex: state.selectedAccountIndex,
    setSelectedAccountIndex,
    selectedAccount,
  }

  return (
    <WalletsContext.Provider value={value}>{children}</WalletsContext.Provider>
  )
}

export function useWallets() {
  const context = useContext(WalletsContext)
  if (context === undefined) {
    throw new Error("useWallets must be used within a WalletsProvider")
  }
  return context
}

export { WalletsContext }
