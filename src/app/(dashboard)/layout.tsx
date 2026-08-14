import { WalletsProvider } from "@/providers/wallet-provider"

import { Toaster } from "@/components/ui/sonner"
import AuthGuard from "@/components/auth-guard"
import NavMenu from "@/components/nav-menu"
import { ProvisionOnSignup } from "@/components/provision-on-signup"
import { RwkRejectionGuard } from "@/components/rwk-rejection-guard"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <main className="bg-muted/40 h-screen dark:bg-neutral-950/80">
        <WalletsProvider>
          <RwkRejectionGuard />
          <ProvisionOnSignup />
          <NavMenu />
          <div className="">{children}</div>
        </WalletsProvider>
        <Toaster />
      </main>
    </AuthGuard>
  )
}
