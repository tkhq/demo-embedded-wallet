"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTransactions } from "@/providers/transactions-provider"
import { useWallets } from "@/providers/wallet-provider"
import { ArrowDownIcon, ArrowUpIcon, LoaderIcon } from "lucide-react"
import { formatEther } from "viem"

import type { Transaction } from "@/types/web3"
import { useTokenPrice } from "@/hooks/use-token-price"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { ScrollArea } from "./ui/scroll-area"

export default function Activity() {
  const { transactions: allTransactions, loading } = useTransactions()
  const { ethPrice } = useTokenPrice()
  const { state } = useWallets()
  const { selectedAccount } = state

  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    const fetchTransactions = async () => {
      if (
        selectedAccount?.address &&
        allTransactions[selectedAccount.address]
      ) {
        setTransactions(allTransactions[selectedAccount.address])
      }
    }
    fetchTransactions()
  }, [allTransactions, selectedAccount])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-2xl">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="flex max-h-[450px] w-full flex-col overflow-y-auto rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="hidden sm:table-cell">To</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                </TableRow>
              ) : transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <TableRow key={transaction.hash}>
                    <TableCell>
                      <Link
                        href={`https://sepolia.etherscan.io/tx/${transaction.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 capitalize"
                      >
                        {transaction.status === "received" ? (
                          <ArrowDownIcon className="h-4 w-4 text-green-500" />
                        ) : transaction.status === "pending" ? (
                          <LoaderIcon className="h-4 w-4 animate-spin text-yellow-500" />
                        ) : (
                          <ArrowUpIcon className="h-4 w-4 text-red-500" />
                        )}
                        {transaction.status}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden p-1 text-xs sm:table-cell md:p-4 md:text-sm">
                      {new Date(transaction.timestamp).toLocaleString("en-US", {
                        month: "long",
                        day: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">
                      <Link
                        className="underline underline-offset-4"
                        href={`https://sepolia.etherscan.io/address/${transaction.from}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {transaction.from.slice(0, 6)}...
                        {transaction.from.slice(-4)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        className="underline underline-offset-4"
                        href={`https://sepolia.etherscan.io/address/${transaction.to}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {transaction?.to?.slice(0, 6)}...
                        {transaction?.to?.slice(-4)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {transaction.value ? formatEther(transaction.value) : 0}{" "}
                        <span className="text-xs text-muted-foreground">
                          ETH
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        $
                        {transaction.value
                          ? (
                              parseFloat(formatEther(transaction.value)) *
                              (ethPrice ?? 0)
                            ).toFixed(2)
                          : 0}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="text-center text-muted-foreground"
                    colSpan={5}
                  >
                    No activity. Send or receive ETH to see transactions here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
