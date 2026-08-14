"use client"

import { useMemo } from "react"
import { CHAIN_LIST, sumUsd } from "@/config/networks"
import { useWallets } from "@/providers/wallet-provider"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"

import { isUserCancelError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import AccountSelector from "./account-selector"
import { Skeleton } from "./ui/skeleton"

export default function WalletCard() {
  const { state, getBalances } = useWallets()
  const { handleImportWallet, handleExportWallet } = useTurnkey()
  const { selectedWallet } = state

  // Aggregate USD across every asset on every chain of the selected wallet.
  const usdAmount = useMemo(() => {
    if (!selectedWallet) return undefined
    return CHAIN_LIST.reduce(
      (total, chain) => total + sumUsd(getBalances(chain.key)),
      0
    )
  }, [selectedWallet, getBalances])

  // The SDK modals reject when the user closes/cancels them; wrap the calls so
  // that rejection is handled (a bare fire-and-forget leaves it unhandled and
  // logs to the console). USER_CANCELED is expected — swallow it.
  const onExport = async () => {
    try {
      await handleExportWallet({ walletId: selectedWallet?.walletId ?? "" })
    } catch (error) {
      if (isUserCancelError(error)) return
      toast.error(error instanceof Error ? error.message : "Export failed")
    }
  }

  const onImport = async () => {
    try {
      await handleImportWallet()
    } catch (error) {
      if (isUserCancelError(error)) return
      toast.error(error instanceof Error ? error.message : "Import failed")
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium">
          {selectedWallet?.walletName || (
            <Skeleton className="bg-muted-foreground/50 h-4 w-20" />
          )}
        </CardTitle>

        <div className="hidden items-center gap-2 sm:flex">
          <AccountSelector />

          <Button variant="outline" onClick={onImport}>
            <Download className="mr-2 h-4 w-4" />
            Import
          </Button>

          <Button variant="outline" onClick={onExport}>
            <Upload className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-4xl font-bold">
          ${usdAmount?.toFixed(2) || "0.00"}
          <span className="text-muted-foreground ml-1 text-sm">USD</span>
        </div>
      </CardContent>
      <CardFooter className="sm:hidden">
        <div className="mx-auto flex w-full flex-col items-center gap-2">
          <AccountSelector className="w-full" />
          <div className="flex w-full items-center gap-2">
            <Button variant="outline" className="w-full" onClick={onImport}>
              <Download className="mr-2 h-4 w-4" />
              Import
            </Button>

            <Button variant="outline" className="w-full" onClick={onExport}>
              <Upload className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
