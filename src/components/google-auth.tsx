"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import { LoadingButton } from "@/components/ui/button.loader"

const GoogleAuth = () => {
  const router = useRouter()
  const { handleGoogleOauth } = useTurnkey()
  const [loading, setLoading] = useState(false)

  const onClick = async () => {
    setLoading(true)
    try {
      await handleGoogleOauth({ openInPage: false })
      router.push("/dashboard")
    } catch (error: any) {
      const message: string = error?.message || "Google login failed"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoadingButton
      type="button"
      className="w-full font-semibold"
      loading={loading}
      onClick={onClick}
    >
      Continue with Google
    </LoadingButton>
  )
}

export default GoogleAuth
