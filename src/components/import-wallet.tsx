"use client"

import { useEffect, useRef, useState } from "react"
import { useWallets } from "@/providers/wallet-provider"
import {
  DEFAULT_ETHEREUM_ACCOUNTS,
  type TurnkeyIframeClient,
} from "@turnkey/sdk-browser"
import { useTurnkey } from "@turnkey/sdk-react"
import { Info, Key, Loader, RectangleEllipsis } from "lucide-react"
import { toast } from "sonner"

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

import { Input } from "./ui/input"

export default function ImportWalletDialog({
  children,
}: {
  children: React.ReactNode
}) {
  const { turnkey, indexedDbClient } = useTurnkey()
  const { import: importConfig } = turnkeyConfig.iFrame
  const [iframeClient, setIframeClient] = useState<TurnkeyIframeClient | null>(
    null
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const iframeContainerRef = useRef<HTMLDivElement | null>(null)
  const [injectResponse, setInjectResponse] = useState(false)
  const [selectedImportType, setSelectedImportType] = useState("seed-phrase")
  const [loading, setLoading] = useState(false)
  const [importComplete, setImportComplete] = useState(false)
  const [importName, setImportName] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDialogOpen && turnkey) {
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

  // Close the dialog and reset the state
  const resetState = () => {
    setSelectedImportType("seed-phrase")
    setImportComplete(false)
    setInjectResponse(false)
    setImportName("")
    setError(null)
    setLoading(false)
  }

  const initIframe = async () => {
    if (iframeContainerRef.current) {
      const iframeContainer = iframeContainerRef.current
      const exportIframeClient = await turnkey?.iframeClient({
        iframeContainer,
        iframeUrl: importConfig.url,
      })
      if (exportIframeClient) {
        setIframeClient(exportIframeClient)
      }
    }
  }

  const initImportWallet = async () => {
    const session = await turnkey?.getSession()

    const initImportResponse = await indexedDbClient?.initImportWallet({
      userId: `${session?.userId}`,
    })

    if (initImportResponse?.importBundle) {
      const injectResponse = await iframeClient?.injectImportBundle(
        initImportResponse.importBundle,
        `${session?.organizationId}`,
        `${session?.userId}`
      )

      if (injectResponse) {
        setInjectResponse(injectResponse)
      }
    }
  }

  const importWallet = async () => {
    const session = await turnkey?.getSession()
    const encryptedBundle = await iframeClient?.extractWalletEncryptedBundle()

    if (encryptedBundle) {
      const importResponse = await indexedDbClient?.importWallet({
        userId: `${session?.userId}`,
        walletName: importName,
        encryptedBundle,
        accounts: DEFAULT_ETHEREUM_ACCOUNTS,
      })

      if (importResponse) {
        setImportComplete(true)
      }
    }
  }

  const initImportPrivateKey = async () => {
    const session = await turnkey?.getSession()

    const initImportResponse = await indexedDbClient?.initImportPrivateKey({
      userId: `${session?.userId}`,
    })

    if (initImportResponse?.importBundle) {
      const injectResponse = await iframeClient?.injectImportBundle(
        initImportResponse.importBundle,
        `${session?.organizationId}`,
        `${session?.userId}`
      )

      if (injectResponse) {
        setInjectResponse(injectResponse)
      }
    }
  }

  const importPrivateKey = async () => {
    const session = await turnkey?.getSession()

    const encryptedBundle = await iframeClient?.extractKeyEncryptedBundle()

    if (encryptedBundle) {
      const importResponse = await indexedDbClient?.importPrivateKey({
        userId: `${session?.userId}`,
        privateKeyName: importName,
        encryptedBundle: encryptedBundle,
        // TODO: Add support for other curves like solana
        curve: "CURVE_SECP256K1",
        addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
      })

      if (importResponse) {
        setImportComplete(true)
      }
    }
  }

  const onSubmit = async () => {
    try {
      if (importComplete) {
        setIsDialogOpen(false)
      } else if (!injectResponse) {
        setLoading(true)
        if (selectedImportType === "seed-phrase") {
          await initImportWallet()
        } else {
          await initImportPrivateKey()
        }
        setLoading(false)
      } else {
        setLoading(true)
        if (selectedImportType === "seed-phrase") {
          await importWallet()
        } else {
          await importPrivateKey()
        }
        setLoading(false)
      }
    } catch (error: any) {
      displayError(error)
    } finally {
      setLoading(false)
    }
  }

  const displayError = (error: any) => {
    if (typeof error === "string") {
      if (error.includes("cannot create uint8array from invalid hex string")) {
        setError("Invalid private key")
      } else {
        setError(error)
      }
    } else if (error?.message?.includes("private key already exists")) {
      setError("Private key already exists")
    } else if (error?.message?.includes("already imported this wallet seed")) {
      setError("Wallet seed already imported")
    } else if (error?.message?.includes("invalid mnemonic")) {
      setError("Invalid seed phrase")
    } else {
      console.error("Import failed:", error, { ...error })
    }
  }

  useEffect(() => {
    if (!isDialogOpen) {
      resetState()
    }
  }, [isDialogOpen])

  useEffect(() => {
    if (importComplete) {
      toast.success(
        `${selectedImportType === "seed-phrase" ? "Wallet" : "Private Key"} imported successfully! 🎉🎉`
      )
    }
  }, [importComplete])

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {injectResponse
              ? `Import ${
                  selectedImportType === "seed-phrase"
                    ? "Wallet"
                    : "Private Key"
                }`
              : "Import Wallet"}
          </DialogTitle>
          <DialogDescription>
            {injectResponse
              ? `Enter your ${
                  selectedImportType === "seed-phrase"
                    ? "seed phrase"
                    : "private key"
                }`
              : "Select import type"}
          </DialogDescription>
        </DialogHeader>

        {!injectResponse && (
          <div className="py-4">
            <RadioGroup
              disabled={injectResponse}
              value={selectedImportType}
              onValueChange={setSelectedImportType}
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
          className={cn({
            hidden: !injectResponse,
          })}
        >
          <div
            className={cn(
              "h-20 w-full overflow-hidden rounded-md bg-muted p-2"
            )}
          >
            <div
              ref={iframeContainerRef}
              className="filter-[brightness(0.96)]"
            />
          </div>
          <div className="inline-flex items-center text-xs text-muted-foreground">
            <Info className="mr-1 h-3 w-3" />
            {selectedImportType === "seed-phrase"
              ? "Seed phrases are typically 12-24 words"
              : "A private key is an alphanumeric string"}
          </div>
        </div>

        <div
          className={cn({
            hidden: !injectResponse,
          })}
        >
          <Input
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            placeholder={
              selectedImportType === "seed-phrase"
                ? "Wallet Name"
                : "Private Key Name"
            }
          />
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
              disabled={loading || (!importName && injectResponse)}
              onClick={onSubmit}
              type="submit"
              className="w-full"
            >
              {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              {!injectResponse
                ? "Continue"
                : importComplete
                  ? "Done"
                  : "Import"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
