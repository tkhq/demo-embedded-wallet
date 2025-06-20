"use client"

import { useEffect, useRef, useState } from "react"
import { useWallets } from "@/providers/wallet-provider"
import { type TurnkeyIframeClient } from "@turnkey/sdk-browser"
import { useTurnkey } from "@turnkey/sdk-react"
import { Key, Loader, RectangleEllipsis } from "lucide-react"

import { turnkeyConfig } from "@/config/turnkey"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function ExportWalletDialog({
  children,
}: {
  children: React.ReactNode
}) {
  const { state } = useWallets()
  const { selectedWallet, selectedAccount } = state
  const { turnkey, indexedDbClient } = useTurnkey()
  const { export: exportConfig } = turnkeyConfig.iFrame
  const [iframeClient, setIframeClient] = useState<TurnkeyIframeClient | null>(
    null
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const iframeContainerRef = useRef<HTMLDivElement | null>(null)
  const [injectResponse, setInjectResponse] = useState(false)
  const [selectedExportType, setSelectedExportType] = useState("seed-phrase")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDialogOpen && turnkey) {
      const initIframe = async () => {
        if (iframeContainerRef.current) {
          const iframeContainer = iframeContainerRef.current
          const exportIframeClient = await turnkey?.iframeClient({
            iframeContainer,
            iframeUrl: exportConfig.url,
          })
          if (exportIframeClient) {
            setIframeClient(exportIframeClient)
          }
        }
      }

      // Create a MutationObserver to watch for changes in the DOM
      const observer = new MutationObserver(() => {
        // If the iframe container is found, initialize the iframe and stop observing
        if (iframeContainerRef.current) {
          initIframe()
          observer.disconnect()
        }
      })

      // If the iframe container is not yet available, start observing the DOM
      if (!iframeContainerRef.current) {
        observer.observe(document.body, { childList: true, subtree: true })
      }

      // Cleanup function to disconnect the observer when the dialog is closed
      return () => observer.disconnect()
    }
  }, [isDialogOpen, turnkey])

  const exportWallet = async () => {
    setError(null)
    // If we've already exported the wallet, close the dialog
    if (injectResponse) {
      setIsDialogOpen(false)
      setInjectResponse(false)
      return
    }

    try {
      setLoading(true)
      if (iframeClient && selectedWallet) {
        if (selectedExportType === "seed-phrase") {
          await exportSeedPhrase()
        } else if (selectedExportType === "private-key") {
          await exportPrivateKey()
        }
      }
    } catch (error) {
      displayError(error)
    } finally {
      setLoading(false)
    }
  }

  const exportSeedPhrase = async () => {
    if (iframeClient && selectedWallet) {
      const exportResponse = await indexedDbClient?.exportWallet({
        walletId: selectedWallet.walletId,
        targetPublicKey: `${iframeClient?.iframePublicKey}`,
      })

      if (exportResponse?.exportBundle) {
        const session = await turnkey?.getSession()
        const response = await iframeClient?.injectWalletExportBundle(
          exportResponse.exportBundle,
          `${session?.organizationId}`
        )

        setInjectResponse(response)
      }
    }
  }

  const exportPrivateKey = async () => {
    if (iframeClient && selectedAccount) {
      const exportResponse = await indexedDbClient?.exportWalletAccount({
        address: selectedAccount.address,
        targetPublicKey: `${iframeClient?.iframePublicKey}`,
      })
      if (exportResponse?.exportBundle) {
        const session = await turnkey?.getSession()
        const response = await iframeClient?.injectKeyExportBundle(
          exportResponse.exportBundle,
          `${session?.organizationId}`
        )

        setInjectResponse(response)
      }
    }
  }

  const displayError = (error: any) => {
    if (
      error?.message?.includes(
        "webauthn authenticator not found in organization"
      )
    ) {
      setError("Unauthorized: Authenticator not found, please try again.")
    }
    console.error(error)
  }

  const resetState = () => {
    setInjectResponse(false)
    setSelectedExportType("seed-phrase")
    setError(null)
  }

  useEffect(() => {
    if (!isDialogOpen) {
      resetState()
    }
  }, [isDialogOpen])

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {injectResponse
              ? `Your ${
                  selectedExportType === "seed-phrase"
                    ? "seed phrase"
                    : "private key"
                }`
              : "Export Wallet"}
          </DialogTitle>
          <DialogDescription>
            {injectResponse
              ? `Do not share your ${
                  selectedExportType === "seed-phrase"
                    ? "seed phrase"
                    : "private key"
                } with anyone.`
              : "Select export type"}
          </DialogDescription>
        </DialogHeader>
        {!injectResponse && (
          <div className="py-4">
            <RadioGroup
              value={selectedExportType}
              onValueChange={setSelectedExportType}
              className="flex gap-4"
            >
              <div className="flex-1">
                <RadioGroupItem
                  value="seed-phrase"
                  id="seed-phrase"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="seed-phrase"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <RectangleEllipsis className="mb-2 h-6 w-6" />
                  Seed Phrase
                </Label>
              </div>
              <div className="flex-1">
                <RadioGroupItem
                  value="private-key"
                  id="private-key"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="private-key"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <Key className="mb-2 h-6 w-6" />
                  Private Key
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
        <div
          className={cn("w-full rounded-md bg-muted p-4", {
            hidden: !injectResponse,
          })}
        >
          <div ref={iframeContainerRef} className="h-1/2" />
        </div>
        <DialogFooter className="w-full">
          <div className="flex w-full flex-col gap-2">
            <div
              className={cn("ml-1 text-xs font-medium text-destructive", {
                hidden: !error,
              })}
            >
              {error}
            </div>
            <Button
              disabled={loading}
              onClick={exportWallet}
              type="submit"
              className="w-full"
            >
              {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              {injectResponse ? "Done" : "Export"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
