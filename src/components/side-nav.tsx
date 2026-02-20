import Link from "next/link"
import { Home, Lock, LogOut } from "lucide-react"

import { ActiveLink } from "@/components/ui/active-link"

import { Icons } from "./icons"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"

export default function SideNav() {
  return (
    <div className="border-r bg-black">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-28 lg:px-6">
          <Link
            href="https://turnkey.com"
            className="flex items-center gap-2 font-semibold"
          >
            <Icons.turnkey className="h-7 w-auto fill-white stroke-none" />
            <span className="sr-only">Primev</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start gap-2 px-2 text-sm font-medium lg:px-6">
            <ActiveLink
              href="/dashboard"
              className="text-muted-foreground hover:text-primary flex items-center gap-3 rounded-lg px-3 py-2 transition-all"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </ActiveLink>
            <ActiveLink
              href="/settings"
              className="text-muted-foreground hover:text-primary flex items-center gap-3 rounded-lg px-3 py-2 transition-all"
            >
              <Lock className="h-4 w-4" />
              Settings
            </ActiveLink>
          </nav>
        </div>
        <Separator className="" />
        <div className="my-2 mt-auto p-4">
          <Button variant="outline" className="w-full gap-2 bg-transparent">
            Disconnect <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
