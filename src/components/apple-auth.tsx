"use client"

import { useState } from "react"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import { LoadingButton } from "@/components/ui/button.loader"

const AppleAuth = () => {
  const { handleAppleOauth } = useTurnkey()
  const [loading, setLoading] = useState(false)

  const onClick = async () => {
    setLoading(true)
    try {
      await handleAppleOauth({ openInPage: false })
      // Rely on user state change to redirect elsewhere in the app
    } catch (error: any) {
      const message: string = error?.message || "Apple login failed"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoadingButton
      type="button"
      variant="outline"
      className="w-full font-semibold"
      loading={loading}
      onClick={onClick}
    >
      Continue with Apple
    </LoadingButton>
  )
}

export default AppleAuth
