"use client"

import { useMemo, useState } from "react"
import {
  accountForChain,
  CHAIN_LIST,
  isNativeAsset,
  networkLabel,
  tokenContractOf,
  unitPriceOf,
  usdOf,
} from "@/config/networks"
import { useWallets } from "@/providers/wallet-provider"
import { ArrowDown, ArrowUp, CopyIcon, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { AssetBalance } from "@/types/turnkey"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import TransferModal, {
  TransferAsset,
  TransferTarget,
} from "./transfer-modal"

interface AssetRow {
  key: string
  iconKey: "ethereum" | "base" | "solana"
  name: string
  chainLabel: string
  address: string
  amount: string
  valueUSD: string
  transfer: TransferAsset
  sendable: boolean
}

// Human-readable crypto amount, preferring Turnkey's formatted `display.crypto`
// and falling back to atomic-unit conversion.
const formatAmount = (b: AssetBalance): string => {
  if (b.display?.crypto) {
    return parseFloat(parseFloat(b.display.crypto).toFixed(8)).toString()
  }
  if (b.balance && b.decimals != null) {
    return parseFloat(
      (Number(b.balance) / 10 ** b.decimals).toFixed(8)
    ).toString()
  }
  return "0"
}

export default function Assets() {
  const { state, networkMode, getBalances, refreshBalances, selectedAccountIndex } =
    useWallets()
  const { selectedWallet } = state
  const [target, setTarget] = useState<TransferTarget | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    toast.success("Address copied to clipboard")
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshBalances()
    } finally {
      setRefreshing(false)
    }
  }

  const rows = useMemo<AssetRow[]>(() => {
    if (!selectedWallet) return []
    // Iterate chains, not accounts: one EVM account serves multiple EVM chains
    // (Ethereum, Base), each rendered as its own set of rows.
    return CHAIN_LIST.flatMap((chain) => {
      const account = accountForChain(selectedWallet, chain.key, selectedAccountIndex)
      if (!account) return []
      const balances = getBalances(chain.key)
      const chainLabel = networkLabel(chain.key, networkMode)

      const toRow = (b: AssetBalance, isNative: boolean, i: number): AssetRow => {
        const symbol = isNative ? chain.nativeSymbol : (b.symbol ?? "TOKEN")
        const contract = isNative
          ? undefined
          : tokenContractOf(chain.key, b.caip19)
        const decimals = isNative ? chain.nativeDecimals : (b.decimals ?? null)
        const transfer: TransferAsset = {
          chain: chain.key,
          symbol,
          // Native rows are the asset (ETH/SOL), not the chain — the chain shows
          // as the row's sublabel. Tokens use their own name/symbol.
          name: isNative ? chain.nativeSymbol : b.name || symbol || chain.label,
          isNative,
          decimals: decimals ?? 0,
          contract,
          fromAddress: account.address,
          balanceAtomic: b.balance ? BigInt(b.balance) : 0n,
          balanceDisplay: formatAmount(b),
          priceUsdPerUnit: unitPriceOf(b),
        }
        return {
          key: `${chain.key}-${b.caip19 ?? b.symbol ?? i}`,
          iconKey: chain.iconKey,
          name: transfer.name,
          chainLabel,
          address: account.address,
          amount: `${formatAmount(b)}${b.symbol ? ` ${b.symbol}` : ""}`,
          valueUSD: `$${usdOf(b).toFixed(2)}`,
          transfer,
          // Native is always sendable; a token needs a parseable contract + decimals.
          sendable: isNative || (!!contract && decimals != null),
        }
      }

      // Always show the chain's native asset, even at zero balance (the Balances
      // API may omit empty balances). Then list any tokens.
      const native = balances.find((b) => isNativeAsset(chain.key, b))
      const nativeRow: AssetRow = native
        ? toRow(native, true, 0)
        : {
            key: `${chain.key}-native`,
            iconKey: chain.iconKey,
            name: chain.nativeSymbol,
            chainLabel,
            address: account.address,
            amount: `0 ${chain.nativeSymbol}`,
            valueUSD: "$0.00",
            sendable: true,
            transfer: {
              chain: chain.key,
              symbol: chain.nativeSymbol,
              name: chain.nativeSymbol,
              isNative: true,
              decimals: chain.nativeDecimals,
              fromAddress: account.address,
              balanceAtomic: 0n,
              balanceDisplay: "0",
            },
          }

      const tokenRows = balances
        .filter((b) => !isNativeAsset(chain.key, b))
        .map((b, i) => toRow(b, false, i + 1))

      return [nativeRow, ...tokenRows]
    })
  }, [selectedWallet, networkMode, getBalances, selectedAccountIndex])

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg sm:text-2xl">Assets</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh balances"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="hidden sm:table-cell">Address</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Value (USD)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground py-8 text-center text-sm"
                  >
                    No assets on this network yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const Icon = Icons[row.iconKey]
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="p-2 font-medium sm:p-4">
                        <div className="flex items-center space-x-2 text-xs sm:text-sm">
                          <Icon className="h-6 w-6" />
                          <div className="flex flex-col">
                            <span>{row.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {row.chainLabel}
                            </span>
                            {/* Full address, copyable, inline on mobile (the
                                Address column is hidden there). Shown in full to
                                avoid the address-poisoning risk of truncation. */}
                            <button
                              onClick={() => copyAddress(row.address)}
                              className="text-muted-foreground hover:text-foreground mt-0.5 inline-flex w-fit items-start gap-1 text-left sm:hidden"
                            >
                              <span className="font-mono text-xs break-all">
                                {row.address}
                              </span>
                              <CopyIcon className="mt-0.5 h-3 w-3 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <button
                          onClick={() => copyAddress(row.address)}
                          className="text-muted-foreground hover:text-foreground inline-flex items-start gap-1 text-left"
                          title="Copy address"
                        >
                          <span className="font-mono text-xs break-all">
                            {row.address}
                          </span>
                          <CopyIcon className="mt-0.5 h-3 w-3 shrink-0" />
                        </button>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {row.amount}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {row.valueUSD}
                      </TableCell>
                      <TableCell className="p-2 sm:hidden">
                        <div className="font-medium">{row.amount}</div>
                        <div className="text-muted-foreground text-sm">
                          {row.valueUSD}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {row.sendable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={`Send ${row.transfer.symbol}`}
                              onClick={() =>
                                setTarget({
                                  action: "send",
                                  asset: row.transfer,
                                })
                              }
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title={`Receive ${row.transfer.symbol}`}
                            onClick={() =>
                              setTarget({
                                action: "receive",
                                asset: row.transfer,
                              })
                            }
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransferModal
        target={target}
        onOpenChange={(open) => !open && setTarget(null)}
      />
    </>
  )
}
