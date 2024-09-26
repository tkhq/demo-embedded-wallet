import { TurnkeyBrowserClient } from "@turnkey/sdk-browser"
import { TurnkeyServerClient } from "@turnkey/sdk-server"
import { createAccount } from "@turnkey/viem"
import {
  Alchemy,
  AlchemyMinedTransactionsAddress,
  AlchemySubscription,
  AssetTransfersCategory,
  Network,
} from "alchemy-sdk"
import {
  Account,
  Address,
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseEther,
  PublicClient,
  webSocket,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

import { env } from "@/env.mjs"
import type { AlchemyMinedTransaction, Transaction } from "@/types/web3"
import { turnkeyConfig } from "@/config/turnkey"

import { showTransactionToast } from "./toast"
import { truncateAddress } from "./utils"

let publicClient: PublicClient

export const getPublicClient = () => {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(turnkeyConfig.rpcUrl),
    })
  }
  return publicClient
}

const settings = {
  apiKey: env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network: Network.ETH_SEPOLIA,
}

const alchemy = new Alchemy(settings)

export const watchMinedTransactions = (
  address: Address,
  callback: (tx: Transaction) => void
) => {
  const addressPairs: [
    AlchemyMinedTransactionsAddress,
    ...AlchemyMinedTransactionsAddress[],
  ] = [{ from: address }, { to: address }] as [
    AlchemyMinedTransactionsAddress,
    ...AlchemyMinedTransactionsAddress[],
  ]

  alchemy.ws.on(
    {
      method: AlchemySubscription.MINED_TRANSACTIONS,
      addresses: addressPairs,
      includeRemoved: true,
      hashesOnly: false,
    },
    ({ transaction }: AlchemyMinedTransaction) => {
      // Convert addresses to checksummed addresses before comparison
      const { from, to } = {
        from: getAddress(transaction.from),
        to: getAddress(transaction.to),
      }
      const txn: Transaction = {
        hash: transaction.hash,
        blockNumber: parseInt(transaction.blockNumber, 16),
        value: BigInt(transaction.value),
        from,
        to,
        status: from === address ? "sent" : "received",
        timestamp: new Date().toISOString(),
      }

      callback?.(txn)
    }
  )
  return () => {
    alchemy.ws.off(AlchemySubscription.MINED_TRANSACTIONS)
  }
}

let webSocketClient: PublicClient

const getWebSocketClient = () => {
  if (!webSocketClient) {
    webSocketClient = createPublicClient({
      chain: sepolia,
      transport: webSocket("wss://ethereum-sepolia-rpc.publicnode.com"),
      // transport: webSocket(
      //   "wss://eth-sepolia.g.alchemy.com/v2/erQ2WeonfN1VMZQM_PgCMTQB4USjPXoD"
      // ),
    })
  }
  return webSocketClient
}

export const watchPendingTransactions = (
  address: Address,
  callback: (tx: any) => void
) => {
  const webSocketClient = getWebSocketClient()
  const publicClient = getPublicClient()
  const unwatch = webSocketClient.watchPendingTransactions({
    onTransactions: (hashes) => {
      hashes.forEach(async (hash) => {
        const tx = await publicClient.getTransaction({ hash })
        if (tx && (tx.from === address || tx.to === address)) {
          callback(tx)
        }
      })
    },
  })

  return unwatch
}

// export const watchPendingTransactions = (
//   address: Address,
//   callback: (tx: Transaction) => void
// ) => {
//   // const publicClient = getPublicClient()
//   // const unwatch = publicClient.watchPendingTransactions({
//   //   onTransactions: (hashes) => console.log(hashes),
//   // })

//   console.log("watching pending transactions for", address)
//   alchemy.ws.on(
//     {
//       method: AlchemySubscription.PENDING_TRANSACTIONS,
//       fromAddress: address,
//     },
//     (tx) => callback(tx)
//   )
//   alchemy.ws.on(
//     {
//       method: AlchemySubscription.PENDING_TRANSACTIONS,
//       toAddress: address,
//     },
//     (tx) => callback(tx)
//   )
// }

export const fundWallet = async (address: Address, amount: string) => {
  const publicClient = getPublicClient()
  // TODO: get private key from env
  const privateKey =
    "0x4b48b9be7ec201bf165e90e89f451bf13ac8b569fd86d0c17977d67dc3642b35"

  const client = createWalletClient({
    chain: sepolia,
    transport: http(turnkeyConfig.rpcUrl),
  })

  const account = privateKeyToAccount(privateKey)

  try {
    const hash = await client.sendTransaction({
      account,
      to: address,
      value: parseEther(amount),
    })

    const toastId = showTransactionToast({
      hash,
      title: "Funding wallet...",
      description: `Sending ${amount} ETH to ${truncateAddress(address)}`,
      type: "loading",
    })

    const transaction = await publicClient.waitForTransactionReceipt({
      hash,
    })

    showTransactionToast({
      id: toastId,
      hash,
      title: "Funds received! 🎉",
      description: `Wallet funded with ${amount} ETH`,
      type: "success",
    })

    return transaction
  } catch (error: unknown) {
    console.error("Error sending funds:", error)

    showTransactionToast({
      title: "Error sending funds",
      description: "Please try again",
      type: "error",
    })

    throw error
  }
}

export const getBalance = async (address: Address) => {
  let response = await alchemy.core.getBalance(address, "latest")
  const balanceBigInt = BigInt(response.toString())
  return balanceBigInt
}

export const getTransactions = async (
  address: Address
): Promise<Transaction[]> => {
  // Fetch sent and received transactions concurrently
  const [sentResponse, receivedResponse] = await Promise.all([
    alchemy.core.getAssetTransfers({
      fromAddress: address,
      excludeZeroValue: false,
      category: [
        AssetTransfersCategory.ERC20,
        AssetTransfersCategory.EXTERNAL,
        AssetTransfersCategory.INTERNAL,
      ],
      withMetadata: true,
    }),
    alchemy.core.getAssetTransfers({
      toAddress: address,
      excludeZeroValue: false,
      category: [
        AssetTransfersCategory.ERC20,
        AssetTransfersCategory.EXTERNAL,
        AssetTransfersCategory.INTERNAL,
      ],
      withMetadata: true,
    }),
  ])

  // Combine and map the responses
  const transactions = [
    ...sentResponse.transfers.map(
      ({ blockNum, from, to, hash, value, metadata }) => ({
        blockNumber: Number(blockNum),
        from: getAddress(from),
        to: to ? getAddress(to) : null,
        hash,
        value: value ? parseEther(value.toString()) : null,
        status: "sent" as const,
        timestamp: metadata.blockTimestamp,
      })
    ),
    ...receivedResponse.transfers.map(
      ({ blockNum, from, to, hash, value, metadata }) => ({
        blockNumber: Number(blockNum),
        from: getAddress(from),
        to: to ? getAddress(to) : null,
        hash,
        value: value ? parseEther(value.toString()) : null,
        status: "received" as const,
        timestamp: metadata.blockTimestamp,
      })
    ),
  ]

  // Sort transactions by block number in descending order
  transactions.sort((a, b) => b.blockNumber - a.blockNumber)

  return transactions
}

/**
 * Creates and returns a wallet client for interacting with the Turnkey API using a specified account.
 *
 * @param {TurnkeyBrowserClient} turnkeyClient - The Turnkey client instance used for the API connection.
 * @param {string} signWith - The Turnkey wallet account address or private key ID used to sign transactions
 * @returns {Promise<WalletClient>} A promise that resolves to the wallet client configured for the specified account and chain.
 */
export const getTurnkeyWalletClient = async (
  turnkeyClient: TurnkeyBrowserClient | TurnkeyServerClient,
  signWith: string
) => {
  // Create a new account using the provided Turnkey client and the specified account for signing
  const turnkeyAccount = await createAccount({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith,
  })

  // Create a wallet client using the newly created account, targeting the Sepolia chain
  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: sepolia,
    transport: http(turnkeyConfig.rpcUrl),
  })

  return client
}
