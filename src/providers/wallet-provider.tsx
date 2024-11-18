"use client"

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react"
import { server } from "@/actions"
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  defaultEthereumAccountAtIndex,
  TurnkeyBrowserClient,
} from "@turnkey/sdk-browser"
import { useTurnkey } from "@turnkey/sdk-react"
import { useLocalStorage } from "usehooks-ts"
import { getAddress } from "viem"

import { Account, PreferredWallet, Wallet } from "@/types/turnkey"
import { PREFERRED_WALLET_KEY } from "@/lib/constants"
import { getBalance } from "@/lib/web3"
import { useUser } from "@/hooks/use-user"

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

async function getWalletsWithAccounts(
  browserClient: TurnkeyBrowserClient,
  organizationId: string
): Promise<Wallet[]> {
  const { wallets } = await browserClient.getWallets()
  return await Promise.all(
    wallets.map(async (wallet) => {
      const { accounts } = await browserClient.getWalletAccounts({
        walletId: wallet.walletId,
      })

      const accountsWithBalance = await accounts.reduce<Promise<Account[]>>(
        async (accPromise, { address, ...account }) => {
          const acc = await accPromise
          // Ensure the account's organizationId matches the provided organizationId
          if (account.organizationId === organizationId) {
            acc.push({
              ...account,
              address: getAddress(address),
              // Balance is initialized to undefined so that it can be fetched lazily on account selection
              balance: await getBalance(getAddress(address)),
            })
          }
          return acc
        },
        Promise.resolve([])
      )

      return { ...wallet, accounts: accountsWithBalance }
    })
  )
}

// @todo - add an updateWallets function that will be called when the user
// updates their wallet settings, such as adding a new account or updating
// the wallet name
export function WalletsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(walletsReducer, initialState)
  const { client, turnkey } = useTurnkey()
  const { user } = useUser()
  const [preferredWallet, setPreferredWallet] =
    useLocalStorage<PreferredWallet>(PREFERRED_WALLET_KEY, {
      userId: "",
      walletId: "",
    })

  useEffect(() => {
    // @todo - ensure that we don't fetch wallets more than once
    // This should only run at initial page load
    const fetchWallets = async () => {
      if (!user?.organization?.organizationId) {
        return
      }
      dispatch({ type: "SET_LOADING", payload: true })
      try {
        // We'll try and get the current user's read-only session
        const browserClient = await turnkey?.currentUserSession()
        if (browserClient) {
          const wallets = await getWalletsWithAccounts(
            browserClient,
            user?.organization?.organizationId
          )
          dispatch({ type: "SET_WALLETS", payload: wallets })
          if (wallets.length > 0) {
            let selectedWallet: Wallet = wallets[0]
            // If the user has a preferred wallet, select it
            if (preferredWallet.userId && preferredWallet.walletId) {
              const wallet = wallets.find(
                (wallet) =>
                  wallet.walletId === preferredWallet.walletId &&
                  user?.userId === preferredWallet.userId
              )

              // Preferred wallet is found select it as the current wallet
              // otherwise select the first wallet in the list of wallets
              if (wallet) {
                selectedWallet = wallet
              }
            }
            selectWallet(selectedWallet)
          }
        } else {
          const currentUser = await turnkey?.getCurrentUser()
          if (currentUser?.organization.organizationId) {
            // This case occurs when the user signs up with a new passkey; since a read-only session is not created for new passkey sign-ups,
            // we need to fetch the wallets from the server

            const wallets = await server.getWalletsWithAccounts(
              currentUser?.organization.organizationId
            )
            dispatch({ type: "SET_WALLETS", payload: wallets })
            if (wallets.length > 0) {
              selectWallet(wallets[0])
            }
          }
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: "Failed to fetch wallets" })
      } finally {
        dispatch({ type: "SET_LOADING", payload: false })
      }
    }
    fetchWallets()
  }, [user, turnkey])

  useEffect(() => {
    if (state.selectedWallet) {
      selectAccount(state.selectedWallet.accounts[0])
    }
  }, [state.selectedWallet])

  const newWalletAccount = async () => {
    dispatch({ type: "SET_LOADING", payload: true })
    try {
      if (state.selectedWallet && client) {
        const newAccount = defaultEthereumAccountAtIndex(
          state.selectedWallet.accounts.length + 1
        )

        const response = await client.createWalletAccounts({
          walletId: state.selectedWallet.walletId,
          accounts: [newAccount],
        })

        if (response && user?.organization.organizationId) {
          // We create a new account object here to skip fetching the full account details from the server
          const account: Account = {
            ...newAccount,
            organizationId: user?.organization.organizationId,
            walletId: state.selectedWallet?.walletId,
            createdAt: {
              seconds: new Date().toISOString(),
              nanos: new Date().toISOString(),
            },
            updatedAt: {
              seconds: new Date().toISOString(),
              nanos: new Date().toISOString(),
            },
            address: getAddress(response.addresses[0]),
            balance: undefined,
          }

          dispatch({ type: "ADD_ACCOUNT", payload: account })
        }
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
      if (client) {
        const { walletId } = await client.createWallet({
          walletName: walletName || "New Wallet",
          accounts: DEFAULT_ETHEREUM_ACCOUNTS,
        })
        if (walletId && user?.organization.organizationId) {
          const wallet = await server.getWallet(
            walletId,
            user?.organization.organizationId
          )
          dispatch({ type: "ADD_WALLET", payload: wallet })
        }
      }
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
    const balance = await getBalance(account.address)
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
