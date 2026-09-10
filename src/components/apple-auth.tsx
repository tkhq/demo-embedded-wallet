"use client"

import { SiApple } from "@icons-pack/react-simple-icons"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import { isUserCancelError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const AppleAuth = () => {
  const { handleAppleOauth, clientState } = useTurnkey()
  const ready = !!clientState

  const onClick = async () => {
    try {
      // Use the in-page (full-page redirect) OAuth flow instead of a popup.
      await handleAppleOauth({ openInPage: true })
      // Rely on user state change to redirect elsewhere in the app
    } catch (error) {
      if (isUserCancelError(error)) return
      const message =
        error instanceof Error ? error.message : "Apple login failed"
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
