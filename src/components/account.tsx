"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { byWalletCreation } from "@/config/networks"
import { useWallets } from "@/providers/wallet-provider"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LogOutIcon,
  PlusCircleIcon,
  SettingsIcon,
} from "lucide-react"
import Jazzicon, { jsNumberForAddress } from "react-jazzicon"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import NetworkToggle from "./network-toggle"
import { Skeleton } from "./ui/skeleton"

function AccountAvatar({ address }: { address: string | undefined }) {
  return (
    <Avatar className="h-1/2 w-auto">
      {address ? (
        <Jazzicon
          svgStyles={{
            filter: "blur(4px)",
          }}
          diameter={32}
          seed={jsNumberForAddress(
            address ?? "0x1111111111111111111111111111111111111111"
          )}
        />
      ) : (
        <AvatarFallback className="bg-transparent text-base font-semibold"></AvatarFallback>
      )}
    </Avatar>
  )
}

export default function Account() {
  const router = useRouter()

  const { state, newWallet, selectWallet, selectedAccount } = useWallets()
  const { wallets, selectedWallet } = state
  const { logout, user } = useTurnkey()

  // Oldest wallet first (the Default Wallet created at sign-up leads the list).
  const sortedWallets = useMemo(
    () => [...wallets].sort(byWalletCreation),
    [wallets]
  )

  const [isOpen, setIsOpen] = useState(false)
  const [isNewWalletMode, setIsNewWalletMode] = useState(false)
  const [newWalletName, setNewWalletName] = useState("")

  const handleNewWallet = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    setIsNewWalletMode(true)
  }

  const handleCreateWallet = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      newWallet(newWalletName)
      setIsNewWalletMode(false)
      setNewWalletName("")
    },
    [newWalletName, newWallet]
  )

  useEffect(() => {
    setTimeout(() => {
      setIsNewWalletMode(false)
    }, 100)
  }, [isOpen])

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger className="dark" asChild>
        <Button
          variant="outline"
          className="text-foreground h-full w-min justify-between gap-3 bg-none"
        >
          <div className="flex items-center gap-3">
            <AccountAvatar address={selectedAccount?.address} />
            {selectedWallet?.walletName ? (
              <div className="text-left">
                <div className="text-sm font-semibold">
                  {selectedWallet?.walletName}
                </div>
              </div>
            ) : (
              <Skeleton className="h-3 w-24 rounded-[3px]" />
            )}
          </div>
          {isOpen ? (
            <ChevronUpIcon className="text-muted-foreground hidden h-4 w-4 sm:block" />
          ) : (
            <ChevronDownIcon className="text-muted-foreground hidden h-4 w-4 sm:block" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-background text-foreground w-80"
      >
        <DropdownMenuLabel className="dark flex w-full items-center gap-2">
          <AccountAvatar address={selectedAccount?.address} />
          <div className="flex flex-col">
            <span className="font-semibold">{user?.userName}</span>
            <span className="text-muted-foreground text-xs">
              {user?.userEmail || ""}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="">
          <span>Wallets</span>
        </DropdownMenuLabel>
        {sortedWallets.map((wallet) => (
          <DropdownMenuCheckboxItem
            key={wallet.walletId}
            checked={selectedWallet?.walletId === wallet.walletId}
            onCheckedChange={() => selectWallet(wallet)}
            onKeyDown={(e) => e.stopPropagation()} // Prevent dropdown menu from handling key events
            className="flex items-center py-2"
          >
            {wallet.walletName}
          </DropdownMenuCheckboxItem>
        ))}

        {isNewWalletMode ? (
          <div className="space-y-2 px-2 py-1.5">
            <input
              autoFocus
              type="text"
              placeholder="Enter wallet name"
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()} // Prevent dropdown menu from handling key events
              className="text-foreground placeholder-muted-foreground w-full bg-transparent px-0 py-1 text-sm focus:outline-hidden"
            />
            <Button
              disabled={!newWalletName}
              onClick={handleCreateWallet}
              variant="outline"
              className="w-full text-sm"
            >
              Create
            </Button>
          </div>
        ) : (
          <DropdownMenuItem onSelect={handleNewWallet}>
            <PlusCircleIcon className="mr-2 h-4 w-4" />
            <span>New Wallet</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          <span>Network</span>
        </DropdownMenuLabel>
        {/* Plain container (not a menu item) so selecting a mode toggles the
            network without closing the menu. */}
        <div
          className="px-2 py-1.5"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <NetworkToggle />
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <SettingsIcon className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOutIcon className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
