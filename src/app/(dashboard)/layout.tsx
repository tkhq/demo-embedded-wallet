import { WalletsProvider } from "@/providers/wallet-provider"

import { Toaster } from "@/components/ui/sonner"
import AuthGuard from "@/components/auth-guard"
import NavMenu from "@/components/nav-menu"
import { SessionExpiryWarning } from "@/components/session-expiry-warning"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <main className="bg-muted/40 h-screen dark:bg-neutral-950/80">
        <WalletsProvider>
          <NavMenu />
          <div className="">{children}</div>
        </WalletsProvider>
        <SessionExpiryWarning />
        <Toaster />
      </main>
    </AuthGuard>
  )
}
