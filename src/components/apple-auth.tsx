"use client"

import { useEffect, useState } from "react"
import { SiApple } from "@icons-pack/react-simple-icons"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const AppleAuth = () => {
  const { handleAppleOauth, clientState } = useTurnkey()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(!!clientState)
  }, [clientState])

  const onClick = async () => {
    try {
      await handleAppleOauth({ openInPage: false })
      // Rely on user state change to redirect elsewhere in the app
    } catch (error: any) {
      const message: string = error?.message || "Apple login failed"
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
            <SiApple className="h-4 w-4" />
            <span className="grow text-center font-normal">
              Continue with Apple
            </span>
          </Button>
        </div>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </>
  )
}

export default AppleAuth
