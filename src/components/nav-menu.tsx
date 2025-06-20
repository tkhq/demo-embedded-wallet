import Link from "next/link"

import Account from "./account"
import { Icons } from "./icons"
import { Badge } from "./ui/badge"

export default function NavMenu() {
  return (
    <div className="flex h-[5rem] items-center justify-between gap-4 bg-black p-4 sm:px-10">
      <div className="flex items-center gap-1">
        <Link href="/dashboard">
          <Icons.turnkey className="h-6 w-auto  fill-white stroke-none sm:h-7" />
        </Link>
        <Badge variant="outline" className="bg-black/80 text-xs text-white">
          Demo
        </Badge>
      </div>
      <div className="flex items-center justify-center gap-4">
        <Account />
      </div>
    </div>
  )
}
