import { Address, Hex } from "viem"

import "viem/window"

export interface Transaction {
  hash: string
  blockNumber: number | null
  value: bigint | null
  from: Address
  to: Address | null
  status: "pending" | "failed" | "received" | "sent"
  timestamp: string
}

export interface AlchemyMinedTransaction {
  removed: boolean
  transaction: {
    blockHash: Hex
    blockNumber: Hex
    from: Address
    gas: Hex
    gasPrice: Hex
    maxFeePerGas: Hex
    maxPriorityFeePerGas: Hex
    hash: Hex
    input: Hex
    nonce: Hex
    to: Address
    transactionIndex: Hex
    value: Hex
    type: Hex
    accessList: any[]
    chainId: Hex
    v: Hex
    r: Hex
    s: Hex
    yParity: Hex
  }
}
