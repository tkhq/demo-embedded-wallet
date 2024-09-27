"use server"

import { Alchemy, AssetTransfersCategory, Network } from "alchemy-sdk"
import { Address, getAddress, parseEther } from "viem"

import { env } from "@/env.mjs"
import type { Transaction } from "@/types/web3"

const settings = {
  apiKey: env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network: Network.ETH_SEPOLIA,
  // https://github.com/alchemyplatform/alchemy-sdk-js/issues/400
  connectionInfoOverrides: {
    skipFetchSetup: true,
  },
}

const alchemy = new Alchemy(settings)

export const getBalance = async (address: Address) => {
  let response = await alchemy.core.getBalance(address, "latest")
  const balanceBigInt = BigInt(response.toString())
  return balanceBigInt
}

export const getTokenBalance = async (address: Address) => {
  const tokenBalances = await alchemy.core.getTokenBalances(address)
  return tokenBalances
}

export const getTransactions = async (
  address: Address
): Promise<Record<string, Transaction[]>> => {
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

  // Map the responses
  const sentTransactions = [
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
  ]
  const receivedTransactions = [
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
  sentTransactions.sort((a, b) => b.blockNumber - a.blockNumber)
  receivedTransactions.sort((a, b) => b.blockNumber - a.blockNumber)

  return {
    sentTransactions,
    receivedTransactions,
  }
}

type TokenPriceResponse<T extends string> = {
  [key in T]: {
    usd: number
  }
}

export const getTokenPrice = async <T extends string>(
  token: T
): Promise<number> => {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-cg-demo-api-key": env.COINGECKO_API_KEY,
    },
  })
  const data: TokenPriceResponse<T> = await response.json()

  return data[token].usd
}
