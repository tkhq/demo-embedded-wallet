"use client"

import { useWallets } from "@/providers/wallet-provider"
import { ChevronDown, PlusCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Selects which account (HD index) of the current wallet is active, and adds a
// new one. Lives on the wallet card so it reads as "accounts under this wallet".
export default function AccountSelector({ className }: { className?: string }) {
  const {
    accountIndexes,
    selectedAccountIndex,
    setSelectedAccountIndex,
    newWalletAccount,
  } = useWallets()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("justify-between", className)}>
          Account {selectedAccountIndex + 1}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {accountIndexes.map((index) => (
          <DropdownMenuCheckboxItem
            key={index}
            checked={selectedAccountIndex === index}
            onCheckedChange={() => setSelectedAccountIndex(index)}
          >
            Account {index + 1}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => newWalletAccount()}>
          <PlusCircleIcon className="mr-2 h-4 w-4" />
          <span>Add Account</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
