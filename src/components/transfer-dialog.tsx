"use client"

import React, { useEffect, useState } from "react"
import { useTransactions } from "@/providers/transactions-provider"
import { useWallets } from "@/providers/wallet-provider"
import { useTurnkey } from "@turnkey/sdk-react"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CopyIcon,
} from "lucide-react"
import QRCode from "react-qr-code"
import { useIsClient, useMediaQuery } from "usehooks-ts"
import { formatEther, getAddress, parseEther, TransactionRequest } from "viem"

import { showTransactionToast } from "@/lib/toast"
import { truncateAddress } from "@/lib/utils"
import { getPublicClient, getTurnkeyWalletClient } from "@/lib/web3"
import { useTokenPrice } from "@/hooks/use-token-price"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { RecipientAddressInput } from "./recipient-address"
import SendTransaction from "./send-transaction"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerTitle,
  DrawerTrigger,
} from "./ui/drawer"
import { Label } from "./ui/label"
import { ValueInput } from "./value-input"

type TransferAction = "send" | "receive"

const DEFAULT_RECIPIENT_ADDRESS = "0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7"

export default function TransferDialog() {
  const { state } = useWallets()
  const { selectedAccount } = state
  const { ethPrice } = useTokenPrice()
  const { turnkey, indexedDbClient } = useTurnkey()
  const { addPendingTransaction } = useTransactions()
  const isDesktop = useMediaQuery("(min-width: 564px)")
  const isClient = useIsClient()

  // Controls the dialog open/close state
  const [isOpen, setIsOpen] = useState(false)

  // Controls the tab selection: send or receive
  const [selectedAction, setSelectedAction] = useState<TransferAction>("send")

  // The amount of ETH to send
  const [ethAmount, setEthAmount] = useState("")

  // Controls the current view: send, receive, or send transaction
  const [currentView, setCurrentView] = useState<
    "send" | "receive" | "sendTransaction"
  >("send")

  // Controls the amount in USD
  const [amountUSD, setAmountUSD] = useState("0")

  // The recipient address to send to, defaults to the Turnkey HQ Faucet
  const [recipientAddress, setRecipientAddress] = useState(
    DEFAULT_RECIPIENT_ADDRESS
  )

  const [transactionRequest, setTransactionRequest] =
    useState<TransactionRequest | null>(null)

  // Ensures that the form is valid before sending
  const [isValid, setIsValid] = useState(false)

  const [walletClient, setWalletClient] = useState<Awaited<
    ReturnType<typeof getTurnkeyWalletClient>
  > | null>(null)

  useEffect(() => {
    const initializeWalletClient = async () => {
      if (!selectedAccount || !indexedDbClient) return

      const walletClient = await getTurnkeyWalletClient(
        indexedDbClient,
        selectedAccount.address
      )
      setWalletClient(walletClient)
    }

    initializeWalletClient()
  }, [selectedAccount, indexedDbClient])

  useEffect(() => {
    const ethAmountParsed = parseFloat(ethAmount || "0")

    if (!isNaN(ethAmountParsed) && ethPrice) {
      const ethPriceParsed = parseFloat(ethPrice.toFixed(2))

      setAmountUSD((ethAmountParsed * ethPriceParsed).toFixed(2))
    }
  }, [ethAmount, ethPrice])

  useEffect(() => {
    if (recipientAddress && selectedAccount?.balance && ethAmount) {
      const ethAmountWei = parseEther(ethAmount)
      const valid = ethAmountWei > 0 && ethAmountWei < selectedAccount.balance
      setIsValid(valid)
    }
  }, [ethAmount, recipientAddress, selectedAccount])

  const handlePreviewSendTransaction = async () => {
    if (!selectedAccount || !walletClient) return
    // Prepare the transaction request to calculate the gas fees
    const transaction = await walletClient.prepareTransactionRequest({
      to: getAddress(recipientAddress),
      value: parseEther(ethAmount),
    })

    setTransactionRequest(transaction)

    setCurrentView("sendTransaction")
  }

  // @todo: This could fit nicely inside of the transaction provider
  const handleSendTransaction = async (
    transactionRequest: TransactionRequest
  ) => {
    if (!selectedAccount || !walletClient) return
    try {
      const publicClient = getPublicClient()
      setIsOpen(false)
      const hash = await walletClient.sendTransaction(transactionRequest)
      addPendingTransaction({
        hash,
        ...transactionRequest,
      })
      const toastId = showTransactionToast({
        hash,
        title: "Sending transaction...",
        description: "View your transaction on explorer",
        type: "loading",
      })
      await publicClient.waitForTransactionReceipt({
        hash,
      })
      showTransactionToast({
        id: toastId,
        hash,
        title: "Transaction sent! 🎉",
        description: `Transaction sent to ${recipientAddress}`,
        type: "success",
      })
    } catch (error) {
      console.error("Error sending transaction:", error)
      showTransactionToast({
        title: "Error sending transaction",
        description: "Please try again",
        type: "error",
      })
    }
  }

  const handleBackToSendTab = () => {
    setCurrentView("send")
  }

  const resetState = () => {
    setCurrentView("send")
    setEthAmount("")
    setAmountUSD("0")
    setTransactionRequest(null)
    setRecipientAddress(DEFAULT_RECIPIENT_ADDRESS)
  }

  useEffect(() => {
    if (!isOpen) {
      resetState()
    }
  }, [isOpen, currentView, selectedAction])

  const SendTab = () => {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="relative flex items-baseline text-7xl font-light">
            <ValueInput
              value={ethAmount}
              onValueChange={setEthAmount}
              className="text-7xl"
              label="ETH"
            />
          </div>

          <div className="text-lg  text-muted-foreground">~${amountUSD}</div>
        </div>

        <div className="flex items-center">
          <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#627eea]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 32 32"
            >
              <g fill="none" fillRule="evenodd">
                <circle cx="16" cy="16" r="16" fill="#627EEA" />
                <g fill="#FFF" fillRule="nonzero">
                  <path fillOpacity=".602" d="M16.498 4v8.87l7.497 3.35z" />
                  <path d="M16.498 4L9 16.22l7.498-3.35z" />
                  <path
                    fillOpacity=".602"
                    d="M16.498 21.968v6.027L24 17.616z"
                  />
                  <path d="M16.498 27.995v-6.028L9 17.616z" />
                  <path
                    fillOpacity=".2"
                    d="M16.498 20.573l7.497-4.353-7.497-3.348z"
                  />
                  <path fillOpacity=".602" d="M9 16.22l7.498 4.353v-7.701z" />
                </g>
              </g>
            </svg>
          </div>
          <div className="flex-grow">
            <div className="font-semibold">Send</div>
            <div className="text-sm ">Ethereum (Sepolia)</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">
              {selectedAccount?.balance
                ? Number(formatEther(selectedAccount?.balance)).toFixed(4)
                : "0"}{" "}
              <span className="text-sm text-muted-foreground">ETH</span>
            </div>
            <div className="text-sm ">Balance</div>
          </div>
          {/* TODO: Could add this back such that when clicked it displays list of wallet accounts to send from */}
          {/* <ChevronRight className="ml-2 " size={20} /> */}
        </div>

        <div className="flex items-center rounded-lg bg-muted p-2  sm:p-4">
          {/* <Input
            placeholder="Enter recipient address"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className=" flex-grow border-none bg-transparent px-2 text-xs placeholder-[#8e8e93]  focus-visible:ring-0 focus-visible:ring-offset-0 sm:px-3 sm:py-2 sm:text-sm"
          /> */}
          <RecipientAddressInput
            initialAddress={recipientAddress}
            onAddressChange={setRecipientAddress}
          />
        </div>

        <Button
          disabled={!isValid}
          className="w-full"
          onClick={handlePreviewSendTransaction}
        >
          Preview Send
          <ChevronRight className="ml-2" size={20} />
        </Button>
      </div>
    )
  }

  const ReceiveTab = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Receive ETH</h2>
          <p className="text-[#8e8e93]">on Ethereum Sepolia Network</p>
        </div>
        <Button variant="ghost" className="text-white">
          <ChevronDown className="mr-2" size={20} />
        </Button>
      </div>

      <div className="mx-auto w-2/5 rounded-lg dark:bg-white sm:w-8/12">
        <QRCode
          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
          value={selectedAccount?.address || ""}
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Your address</Label>
        <div className="flex items-center justify-between rounded-lg">
          <div className="text-sm">
            {isDesktop
              ? selectedAccount?.address
              : truncateAddress(selectedAccount?.address || "", {
                  prefix: 10,
                  suffix: 6,
                })}
          </div>
          <Button variant="ghost" size="icon">
            <CopyIcon className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <Alert className="p-3 pb-2 ">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs text-muted-foreground">
          This address can only receive testnet Ethereum (Sepolia). Sending any
          other asset to this address will result in loss of funds.
        </AlertDescription>
      </Alert>
    </div>
  )

  const TransferContent = ({ className }: React.ComponentProps<"div">) => (
    <Card className="w-full border-0  shadow-none">
      <CardContent className="p-4">
        {currentView === "send" && (
          <Tabs defaultValue={selectedAction} className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-2 ">
              <TabsTrigger value="send">Send</TabsTrigger>
              <TabsTrigger value="receive">Receive</TabsTrigger>
            </TabsList>
            <TabsContent value="send">
              <SendTab />
            </TabsContent>
            <TabsContent value="receive">
              <ReceiveTab />
            </TabsContent>
          </Tabs>
        )}
        {currentView === "sendTransaction" &&
          transactionRequest &&
          ethPrice && (
            <SendTransaction
              transaction={transactionRequest}
              amountUSD={amountUSD}
              ethPrice={ethPrice}
              network="Ethereum"
              onSend={handleSendTransaction}
              onBack={handleBackToSendTab}
            />
          )}
      </CardContent>
    </Card>
  )

  // Prevents hydration errors
  if (!isClient) {
    return null
  }

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-center gap-2">
          <DialogTrigger asChild>
            <Button
              onClick={() => setSelectedAction("send")}
              variant="secondary"
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Send
            </Button>
          </DialogTrigger>
          <DialogTrigger asChild>
            <Button
              onClick={() => setSelectedAction("receive")}
              variant="secondary"
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Receive
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent className="p-4 sm:max-w-[480px]">
          <DialogTitle className="sr-only">Transfer Dialog</DialogTitle>
          <DialogDescription className="sr-only">
            Send or receive ETH to your Turnkey wallet
          </DialogDescription>
          <TransferContent />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex w-full items-center justify-center gap-2">
        <DrawerTrigger asChild>
          <Button
            onClick={() => setSelectedAction("send")}
            variant="secondary"
            className="w-full"
          >
            <ArrowUp className="mr-2 h-4 w-4" />
            Send
          </Button>
        </DrawerTrigger>
        <DrawerTrigger asChild>
          <Button
            onClick={() => setSelectedAction("receive")}
            variant="secondary"
            className="w-full"
          >
            <ArrowDown className="mr-2 h-4 w-4" />
            Receive
          </Button>
        </DrawerTrigger>
      </div>
      <DrawerContent className="px-4">
        <DrawerTitle className="sr-only">Transfer ETH</DrawerTitle>
        <DrawerDescription className="sr-only">
          Send or receive ETH to your Turnkey wallet
        </DrawerDescription>

        <TransferContent className="px-4" />
        <DrawerFooter className="m-0 py-0 pb-4">
          <DrawerClose asChild>
            <Button variant="secondary">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
