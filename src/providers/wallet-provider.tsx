"use client"

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { useLocalStorage } from "usehooks-ts"
import { getAddress } from "viem"

import { Account, PreferredWallet, Wallet } from "@/types/turnkey"
import { PREFERRED_WALLET_KEY } from "@/lib/constants"
import { getBalance } from "@/lib/web3"

interface WalletsState {
  loading: boolean
  error: string
  wallets: Wallet[]
  selectedWallet: Wallet | null
  selectedAccount: Account | null
}

type Action =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_WALLETS"; payload: Wallet[] }
  | { type: "SET_SELECTED_WALLET"; payload: Wallet }
  | { type: "SET_SELECTED_ACCOUNT"; payload: Account }
  | { type: "ADD_WALLET"; payload: Wallet }
  | { type: "ADD_ACCOUNT"; payload: Account }

const WalletsContext = createContext<
  | {
      state: WalletsState
      dispatch: React.Dispatch<Action>
      newWallet: (walletName?: string) => Promise<void>
      newWalletAccount: () => Promise<void>
      selectWallet: (wallet: Wallet) => void
      selectAccount: (account: Account) => void
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
    case "SET_SELECTED_ACCOUNT":
      return { ...state, selectedAccount: action.payload }
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
  selectedAccount: null,
}

// @todo - add an updateWallets function that will be called when the user
// updates their wallet settings, such as adding a new account or updating
// the wallet name
export function WalletsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(walletsReducer, initialState)
  const {
    wallets: hookWallets,
    createWallet,
    createWalletAccounts,
    refreshWallets,
    user,
    session,
  } = useTurnkey()

  const [preferredWallet, setPreferredWallet] =
    useLocalStorage<PreferredWallet>(PREFERRED_WALLET_KEY, {
      userId: "",
      walletId: "",
    })
  const balanceCacheRef = useRef<Map<string, Promise<bigint> | bigint>>(
    new Map()
  )
  const pendingSelectWalletIdRef = useRef<string | null>(null)
  const pendingSelectAccountAddressRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session?.organizationId) {
      return
    }

    const normalizedWallets: Wallet[] = (hookWallets ?? []).map(
      (wallet: any) => ({
        ...wallet,
        accounts: (wallet.accounts ?? []).map((account: any) => ({
          ...account,
          address: getAddress(account.address),
        })),
      })
    )

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
      }
    }

    // If a wallet has been requested for selection by id (optimistic path), try to select it
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

    // If a newly created account address is pending selection, select it once it exists in the current selected wallet
    if (pendingSelectAccountAddressRef.current && state.selectedWallet) {
      const currentWallet = normalizedWallets.find(
        (w) => w.walletId === state.selectedWallet?.walletId
      )
      const account = currentWallet?.accounts?.find(
        (a: any) =>
          getAddress(a.address) === pendingSelectAccountAddressRef.current
      )
      if (account) {
        // Select the newly created account and clear the pending ref
        selectAccount(account as Account)
        pendingSelectAccountAddressRef.current = null
      }
    }

    // Only auto-select when nothing is selected to avoid overriding user choice
    if (!state.selectedWallet) {
      let selected: Wallet = normalizedWallets[0]
      if (preferredWallet.userId === user?.userId && preferredWallet.walletId) {
        const preferred = normalizedWallets.find(
          (w) => w.walletId === preferredWallet.walletId
        )
        if (preferred) selected = preferred
      }
      selectWallet(selected)
    }
  }, [hookWallets, user])

  useEffect(() => {
    if (
      state.selectedWallet &&
      state.selectedWallet.accounts?.length &&
      !state.selectedAccount &&
      !pendingSelectAccountAddressRef.current
    ) {
      selectAccount(state.selectedWallet.accounts[0])
    }
  }, [state.selectedWallet, state.selectedAccount])

  async function getCachedBalance(address: string): Promise<bigint> {
    const key = getAddress(address)
    const cached = balanceCacheRef.current.get(key)
    if (cached instanceof Promise) return cached
    if (typeof cached === "bigint") return cached

    const promise = getBalance(key)
      .then((balance) => {
        balanceCacheRef.current.set(key, balance)
        return balance
      })
      .catch((error) => {
        balanceCacheRef.current.delete(key)
        throw error
      })

    balanceCacheRef.current.set(key, promise)
    return promise
  }

  const newWalletAccount = async () => {
    dispatch({ type: "SET_LOADING", payload: true })
    try {
      if (state.selectedWallet) {
        const created = await createWalletAccounts({
          walletId: state.selectedWallet.walletId,
          accounts: ["ADDRESS_FORMAT_ETHEREUM"],
        })
        const createdAddress = Array.isArray(created) ? created[0] : created
        if (createdAddress) {
          pendingSelectAccountAddressRef.current = getAddress(createdAddress)
        }
        await refreshWallets()
      }
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
        accounts: ["ADDRESS_FORMAT_ETHEREUM"],
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

  const selectWallet = (wallet: Wallet) => {
    dispatch({ type: "SET_SELECTED_WALLET", payload: wallet })
    setPreferredWallet({
      userId: user?.userId || "",
      walletId: wallet.walletId,
    })
  }

  const selectAccount = async (account: Account) => {
    const balance = await getCachedBalance(account.address)
    dispatch({
      type: "SET_SELECTED_ACCOUNT",
      payload: { ...account, balance },
    })
  }

  const value = {
    state,
    dispatch,
    newWallet,
    newWalletAccount,
    selectWallet,
    selectAccount,
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
