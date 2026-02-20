"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export interface ActiveLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
}

const ActiveLink = React.forwardRef<HTMLAnchorElement, ActiveLinkProps>(
  ({ className, href, children, ...props }, ref) => {
    const pathname = usePathname()
    const isActive = pathname === href

    return (
      <Link
        href={href}
        className={cn(
          className,
          "text-muted-foreground hover:text-primary flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
          isActive ? "text-primev" : ""
        )}
        ref={ref}
        {...props}
      >
        {children}
      </Link>
    )
  }
)
ActiveLink.displayName = "ActiveLink"

export { ActiveLink }
