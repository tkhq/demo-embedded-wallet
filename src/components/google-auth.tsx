"use client"

import { useEffect, useState } from "react"
import { SiGoogle } from "@icons-pack/react-simple-icons"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const GoogleAuth = () => {
  const { handleGoogleOauth, clientState } = useTurnkey()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(!!clientState)
  }, [clientState])

  const onClick = async () => {
    try {
      await handleGoogleOauth({ openInPage: false })
      // Rely on user state change to redirect elsewhere in the app
    } catch (error: any) {
      const message: string = error?.message || "Google login failed"
      toast.error(message)
    }
  }

  return (
    <>
      {ready ? (
        <div className="flex w-full justify-center">
          <Button
            variant="outline"
            className="flex w-[235px] items-center justify-between"
            onClick={onClick}
          >
            <SiGoogle className="h-4 w-4" />
            <span className="grow text-center font-normal">
              Continue with Google
            </span>
          </Button>
        </div>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </>
  )
}

export default GoogleAuth
