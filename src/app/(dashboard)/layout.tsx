import { WalletsProvider } from "@/providers/wallet-provider"

import { Toaster } from "@/components/ui/sonner"
import NavMenu from "@/components/nav-menu"
import { SessionExpiryWarning } from "@/components/session-expiry-warning"
import { DemoBanner } from "@/components/demo-banner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className=" h-screen bg-muted/40 dark:bg-neutral-950/80">
      <WalletsProvider>
        <NavMenu />
        <DemoBanner />

        <div className="">{children}</div>
      </WalletsProvider>
      <SessionExpiryWarning />
      <Toaster />
    </main>
  )
}
