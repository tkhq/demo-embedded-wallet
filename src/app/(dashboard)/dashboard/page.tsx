import Assets from "@/components/assets"
import WalletCard from "@/components/wallet-card"

export default function Dashboard() {
  return (
    <main className="container mx-auto space-y-4 p-2 sm:p-8 lg:space-y-8 xl:px-12 2xl:px-24">
      <WalletCard />
      <div className="flex flex-col gap-4">
        <Assets />
      </div>
    </main>
  )
}
