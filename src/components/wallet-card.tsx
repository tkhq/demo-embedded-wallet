"use client"

import { useEffect, useState } from "react"
import { useWallets } from "@/providers/wallet-provider"
import { ExportType, useTurnkey } from "@turnkey/react-wallet-kit"
import { CopyIcon, Download, Upload } from "lucide-react"
import { toast } from "sonner"
import { formatEther } from "viem"

import { truncateAddress } from "@/lib/utils"
import { useTokenPrice } from "@/hooks/use-token-price"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import TransferDialog from "./transfer-dialog"
import { Skeleton } from "./ui/skeleton"

export default function WalletCard() {
  const { ethPrice } = useTokenPrice()
  const { state } = useWallets()
  const { handleImport, handleExport } = useTurnkey()
  const { selectedWallet, selectedAccount } = state
  const [usdAmount, setUsdAmount] = useState<number | undefined>(undefined)

  const handleCopyAddress = () => {
    if (selectedAccount?.address) {
      navigator.clipboard.writeText(selectedAccount.address)
      toast.success("Address copied to clipboard")
    }
  }

  useEffect(() => {
    if (ethPrice && selectedAccount?.balance !== undefined) {
      const balanceInEther = formatEther(selectedAccount?.balance)
      setUsdAmount(Number(balanceInEther) * ethPrice)
    }
  }, [ethPrice, selectedAccount?.balance])

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium">
          {selectedWallet?.walletName || (
            <Skeleton className="bg-muted-foreground/50 h-4 w-20" />
          )}
        </CardTitle>

        <div className="hidden items-center gap-2 sm:flex">
          <TransferDialog />

          <Button variant="outline" onClick={() => handleImport()}>
            <Download className="mr-2 h-4 w-4" />
            Import
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              handleExport({
                walletId: selectedWallet?.walletId ?? "",
                exportType: ExportType.Wallet,
              })
            }
          >
            <Upload className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-sm">
          {selectedAccount?.address ? (
            <div
              onClick={handleCopyAddress}
              className="flex w-min cursor-pointer items-center gap-2"
            >
              {truncateAddress(selectedAccount?.address)}
              <CopyIcon className="h-3 w-3" />
            </div>
          ) : (
            <Skeleton className="bg-muted-foreground/50 h-3 w-32 rounded-sm" />
          )}
        </div>
        <div className="text-4xl font-bold">
          ${usdAmount?.toFixed(2) || "0.00"}
          <span className="text-muted-foreground ml-1 text-sm">USD</span>
        </div>
        <div className="text-muted-foreground text-sm">
          {selectedAccount?.balance
            ? parseFloat(
                Number(formatEther(selectedAccount?.balance)).toFixed(8)
              ).toString()
            : "0"}{" "}
          ETH
        </div>
      </CardContent>
      <CardFooter className="sm:hidden">
        <div className="mx-auto flex w-full flex-col items-center gap-2">
          <TransferDialog />
          <div className="flex w-full items-center gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleImport()}
            >
              <Download className="mr-2 h-4 w-4" />
              Import
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                handleExport({
                  walletId: selectedWallet?.walletId ?? "",
                  exportType: ExportType.Wallet,
                })
              }
            >
              <Upload className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
