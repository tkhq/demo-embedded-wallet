"use client"

import { useMemo } from "react"
import { useWallets } from "@/providers/wallet-provider"
import { formatEther } from "viem"

import { truncateAddress } from "@/lib/utils"
import { useTokenPrice } from "@/hooks/use-token-price"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Icons } from "./icons"

export default function Assets() {
  const { state } = useWallets()
  const { ethPrice } = useTokenPrice()
  const { selectedAccount } = state

  // Memoize the balance calculation
  const amount = useMemo(() => {
    return selectedAccount?.balance
      ? parseFloat(
          Number(formatEther(selectedAccount?.balance ?? BigInt(0))).toFixed(8)
        ).toString()
      : "0"
  }, [selectedAccount?.balance])

  // Memoize the value calculation
  const valueInUSD = useMemo(() => {
    return (
      Number(formatEther(selectedAccount?.balance ?? BigInt(0))) *
      (ethPrice || 0)
    ).toFixed(2)
  }, [selectedAccount?.balance, ethPrice])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-2xl">Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="">
              <TableHead>Asset</TableHead>
              <TableHead className="hidden sm:table-cell">Address</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="hidden sm:table-cell">
                Value (USD)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="p-2 font-medium sm:p-4">
                <div className="flex items-center space-x-2 text-xs sm:text-sm">
                  <Icons.ethereum className="h-6 w-6" />
                  <span>Ethereum (Sepolia)</span>
                </div>
              </TableCell>
              <TableCell className="hidden font-mono text-xs sm:table-cell">
                {selectedAccount?.address &&
                  truncateAddress(selectedAccount?.address)}
              </TableCell>
              <TableCell className="hidden sm:table-cell">{amount}</TableCell>
              <TableCell className="hidden sm:table-cell">
                ${valueInUSD}
              </TableCell>
              <TableCell className="p-2 sm:hidden">
                <div className="font-medium">
                  {amount}
                  <span className="text-muted-foreground ml-1 text-xs">
                    ETH
                  </span>
                </div>
                <div className="text-muted-foreground text-sm">
                  ${valueInUSD}
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
