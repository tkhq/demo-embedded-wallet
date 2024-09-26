"use server"

import { Alchemy, Network } from "alchemy-sdk"
import { Address } from "viem"

import { env } from "@/env.mjs"

const settings = {
  apiKey: env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network: Network.ETH_SEPOLIA,
}

const alchemy = new Alchemy(settings)

export const getTokenBalance = async (address: Address) => {
  const tokenBalances = await alchemy.core.getTokenBalances(address)
  return tokenBalances
}

export const getBalance = async (address: Address) => {
  let response = await alchemy.core.getBalance(address, "latest")
  const balanceBigInt = BigInt(response.toString())
  return balanceBigInt
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
