"use client"

import { useEffect, useState } from "react"
import {
  caip2For,
  ChainKey,
  CHAINS,
  EvmCaip2,
  isEvmChain,
  networkLabel,
  SolanaCaip2,
} from "@/config/networks"
import { useWallets } from "@/providers/wallet-provider"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { AlertCircle, ChevronRight, CopyIcon } from "lucide-react"
import QRCode from "react-qr-code"
import { toast } from "sonner"
import { useIsClient, useMediaQuery } from "usehooks-ts"
import { getAddress, isAddress, parseUnits } from "viem"

import { buildErc20TransferData } from "@/lib/evm"
import { getAllowedRecipients } from "@/lib/root-quorum"
import {
  buildUnsignedSolTransfer,
  buildUnsignedSplTransfer,
  isValidSolanaAddress,
} from "@/lib/solana"
import { cn, isSendRejectedError, isUserCancelError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

import { Icons } from "./icons"
import { RecipientAddressInput } from "./recipient-address"
import { Alert, AlertDescription } from "./ui/alert"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerTitle,
} from "./ui/drawer"
import { Label } from "./ui/label"
import { ValueInput } from "./value-input"

export type TransferAction = "send" | "receive"

// A single asset to send or receive. Everything the modal needs is passed in, so
// the modal renders one action for one asset — no chain/asset pickers.
export type TransferAsset = {
  chain: ChainKey
  symbol: string
  name: string
  isNative: boolean
  decimals: number
  // ERC-20 contract / SPL mint; undefined for the native asset.
  contract?: string
  // The wallet's account address on this chain (sender / receive address).
  fromAddress: string
  // Balance in atomic units, for affordability checks.
  balanceAtomic: bigint
  // Pre-formatted human balance for the "Balance" line.
  balanceDisplay: string
  // USD per whole unit (from Turnkey's display fields); undefined on testnet.
  priceUsdPerUnit?: number
}

export type TransferTarget = { action: TransferAction; asset: TransferAsset }

// Convenience default only for native ETH (testnet faucet); everything else is
// blank so the user pastes a recipient.
const ETH_FAUCET = "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7"
const defaultRecipient = (asset: TransferAsset) =>
  asset.chain === "ethereum" && asset.isNative ? ETH_FAUCET : ""

export default function TransferModal({
  target,
  onOpenChange,
}: {
  target: TransferTarget | null
  onOpenChange: (open: boolean) => void
}) {
  const isDesktop = useMediaQuery("(min-width: 564px)")
  const isClient = useIsClient()

  // Prevents hydration mismatch (Dialog vs Drawer depends on viewport).
  if (!isClient) return null

  const open = target !== null
  const body = target ? (
    // Keyed by asset+action so form state resets each time the modal opens.
    <TransferBody
      key={`${target.asset.chain}:${target.asset.symbol}:${target.action}`}
      target={target}
      onClose={() => onOpenChange(false)}
    />
  ) : null

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-4 sm:max-w-[480px]">
          <DialogTitle className="sr-only">Transfer</DialogTitle>
          <DialogDescription className="sr-only">
            Send or receive assets with your Turnkey wallet
          </DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-4">
        <DrawerTitle className="sr-only">Transfer</DrawerTitle>
        <DrawerDescription className="sr-only">
          Send or receive assets with your Turnkey wallet
        </DrawerDescription>
        {body}
        <DrawerFooter className="m-0 py-0 pb-4">
          <DrawerClose asChild>
            <Button variant="secondary">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function TransferBody({
  target,
  onClose,
}: {
  target: TransferTarget
  onClose: () => void
}) {
  const { networkMode, refreshBalances } = useWallets()
  const { handleSendTransaction, httpClient, session } = useTurnkey()
  const organizationId = session?.organizationId
  const { asset, action } = target
  const chainCfg = CHAINS[asset.chain]
  const Icon = Icons[chainCfg.iconKey]

  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState(defaultRecipient(asset))

  // Amount in atomic units (null when empty/unparseable).
  const atomic = (() => {
    if (!amount) return null
    try {
      return parseUnits(amount, asset.decimals)
    } catch {
      return null
    }
  })()

  const recipientValid = isEvmChain(asset.chain)
    ? isAddress(recipient)
    : isValidSolanaAddress(recipient)

  // Live send allowlist for this chain, read from the sub-org's ACTUAL policies
  // (not the static config) so it always reflects what's enforced. Empty on
  // mainnet / Solana (allow-any). EVM only; Solana skips the fetch.
  const evm = isEvmChain(asset.chain)
  const chainId = evm
    ? Number(caip2For(asset.chain, networkMode).split(":")[1])
    : undefined
  // Only the EVM fetch uses state (null until it lands). Solana / non-EVM is
  // allow-any, known synchronously, so it's derived below rather than stored —
  // which also keeps the effect free of a synchronous setState.
  const [fetchedAllowlist, setFetchedAllowlist] = useState<string[] | null>(null)
  useEffect(() => {
    if (
      action !== "send" ||
      !httpClient ||
      !organizationId ||
      chainId === undefined
    ) {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await getAllowedRecipients(
          httpClient,
          organizationId,
          chainId
        )
        if (!cancelled) setFetchedAllowlist(list)
      } catch (err) {
        // Leave unresolved (null) on error — never claim "any address" when we
        // couldn't read the policies. The modal still works without chips.
        console.error("Load send allowlist failed:", err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [action, httpClient, organizationId, chainId])
  // null = not yet resolved; [] = resolved allow-any (mainnet / Solana);
  // non-empty = resolved allowlist (testnet EVM). The null vs [] distinction
  // avoids flashing "any address" before the fetch lands.
  const allowlist = chainId === undefined ? [] : fetchedAllowlist
  const hasAllowlist = !!allowlist && allowlist.length > 0
  const allowAny = allowlist !== null && allowlist.length === 0
  const recipientAllowlisted =
    recipientValid && !!allowlist && allowlist.includes(recipient.toLowerCase())

  const isValid =
    atomic !== null &&
    atomic > 0n &&
    atomic <= asset.balanceAtomic &&
    recipientValid

  const amountUSD =
    asset.priceUsdPerUnit != null && amount
      ? (parseFloat(amount) * asset.priceUsdPerUnit).toFixed(2)
      : "0"

  const copyAddress = () => {
    navigator.clipboard.writeText(asset.fromAddress)
    toast.success("Address copied to clipboard")
  }

  // Sponsored send via Turnkey transaction management. Turnkey's modal handles
  // confirmation, progress, success and the explorer link, so we close our own
  // modal and hand off. Balances refresh once the handler resolves.
  const handleSend = async () => {
    if (atomic === null) return
    try {
      onClose()
      if (isEvmChain(asset.chain)) {
        const caip2 = caip2For(asset.chain, networkMode) as EvmCaip2
        if (asset.isNative) {
          await handleSendTransaction({
            transaction: {
              from: asset.fromAddress,
              to: getAddress(recipient),
              value: atomic.toString(),
              caip2,
              sponsor: true,
            },
          })
        } else if (asset.contract) {
          await handleSendTransaction({
            transaction: {
              from: asset.fromAddress,
              to: getAddress(asset.contract),
              value: "0",
              data: buildErc20TransferData(recipient, atomic),
              caip2,
              sponsor: true,
            },
          })
        }
      } else {
        const caip2 = caip2For(asset.chain, networkMode) as SolanaCaip2
        const unsignedTransaction = asset.isNative
          ? buildUnsignedSolTransfer(asset.fromAddress, recipient, Number(atomic))
          : buildUnsignedSplTransfer(
              asset.fromAddress,
              recipient,
              asset.contract!,
              atomic,
              asset.decimals
            )
        await handleSendTransaction({
          transaction: {
            signWith: asset.fromAddress,
            unsignedTransaction,
            caip2,
            sponsor: true,
          },
        })
      }
      await refreshBalances()
    } catch (error) {
      if (isUserCancelError(error)) return
      console.error("Error sending transaction:", error)
      if (isSendRejectedError(error)) {
        // In this demo the user is a 2/2 root member and all policies are
        // ALLOW (no DENY), so a transfer that isn't covered by policy isn't
        // rejected — it escalates to CONSENSUS_NEEDED, awaiting the Policy
        // Manager's co-signature. Surface that as pending, not a failure.
        toast.message("Transfer pending co-signature", {
          description:
            "This transfer isn't covered by your wallet's policy, so it needs the Policy Manager to co-sign before it can go through. Track it under Settings → Admin.",
        })
      } else {
        toast.error(
          error instanceof Error ? error.message : "Transaction failed"
        )
      }
    }
  }

  const renderSend = () => (
    <div className="flex flex-col gap-6">
      <div>
        <div className="relative flex items-baseline text-7xl font-light">
          <ValueInput
            value={amount}
            onValueChange={setAmount}
            className="text-7xl"
            label={asset.symbol}
          />
        </div>
        <div className="text-muted-foreground text-lg">~${amountUSD}</div>
      </div>

      <div className="flex items-center">
        <div className="mr-4 h-10 w-10">
          <Icon className="h-10 w-10" />
        </div>
        <div className="grow">
          <div className="font-semibold">Send {asset.symbol}</div>
          <div className="text-sm">{networkLabel(asset.chain, networkMode)}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold">
            {asset.balanceDisplay}{" "}
            <span className="text-muted-foreground text-sm">{asset.symbol}</span>
          </div>
          <div className="text-sm">Balance</div>
        </div>
      </div>

      <div className="space-y-2">
        {hasAllowlist && (
          <div className="flex flex-col gap-2">
            {/* Full address shown intentionally: a truncated chip is exactly
                what address-poisoning attacks rely on, so the whole address
                must be verifiable at a glance. */}
            {allowlist.map((addr) => {
              const checksummed = getAddress(addr)
              const selected = recipient.toLowerCase() === addr
              return (
                <button
                  key={addr}
                  type="button"
                  onClick={() => setRecipient(checksummed)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <span className="min-w-0 flex-1 font-mono text-xs break-all">
                    {checksummed}
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    ALLOWLISTED
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setRecipient("")}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                recipientValid && !recipientAllowlisted
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted"
              )}
            >
              Custom address
            </button>
          </div>
        )}

        <div className="bg-muted flex items-center rounded-lg p-2 sm:p-4">
          <RecipientAddressInput value={recipient} onChange={setRecipient} />
        </div>

        {hasAllowlist && recipientAllowlisted && (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Allowlisted destination — single approval.
          </p>
        )}
        {hasAllowlist && recipientValid && !recipientAllowlisted && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Destination is not on the allowlist — dual control enforced. 2 of
              2 approvals required.
            </span>
          </div>
        )}
        {allowAny && (
          <p className="text-muted-foreground text-xs">
            Sends allowed to any address on this network.
          </p>
        )}
      </div>

      <Alert className="p-3 pb-2">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-muted-foreground text-xs">
          {networkMode === "mainnet"
            ? "You are on Mainnet — this moves real funds. Gas is sponsored by Turnkey."
            : "Gas is sponsored by Turnkey — you don't need funds to cover network fees."}
        </AlertDescription>
      </Alert>

      <Button disabled={!isValid} className="w-full" onClick={handleSend}>
        Send
        <ChevronRight className="ml-2" size={20} />
      </Button>
    </div>
  )

  const renderReceive = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Receive {asset.symbol}</h2>
        <p className="text-muted-foreground">
          on {networkLabel(asset.chain, networkMode)}
        </p>
      </div>

      <div className="mx-auto w-2/5 rounded-lg sm:w-8/12 dark:bg-white">
        <QRCode
          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
          value={asset.fromAddress}
        />
      </div>

      <div>
        <Label className="text-sm font-medium">
          Your {chainCfg.label} address
        </Label>
        <div className="flex items-start justify-between gap-2 rounded-lg">
          <span className="font-mono text-sm break-all">
            {asset.fromAddress}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={copyAddress}
          >
            <CopyIcon className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Alert className="p-3 pb-2">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-muted-foreground text-xs">
          {asset.isNative
            ? `This address is for ${chainCfg.label}${
                networkMode === "testnet" ? ` (${chainCfg.testnetName})` : ""
              }. Sending assets from another network may result in loss of funds.`
            : `Send only ${asset.symbol} on ${chainCfg.label} to this address. Other assets or networks may result in loss of funds.`}
        </AlertDescription>
      </Alert>
    </div>
  )

  return (
    <Card className="w-full border-0 shadow-none">
      <CardContent className="p-4">
        {action === "send" ? renderSend() : renderReceive()}
      </CardContent>
    </Card>
  )
}
