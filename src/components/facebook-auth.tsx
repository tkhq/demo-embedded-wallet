"use client"

import { SiFacebook } from "@icons-pack/react-simple-icons"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import { isUserCancelError } from "@/lib/utils"

import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"

const FacebookAuth = () => {
  const { handleFacebookOauth, clientState } = useTurnkey()
  const ready = !!clientState

  const onClick = async () => {
    try {
      await handleFacebookOauth({ openInPage: false })
      // Rely on user state change to redirect elsewhere in the app
    } catch (error) {
      // Closing the popup rejects with USER_CANCELED — not an error to surface.
      if (isUserCancelError(error)) return
      const message =
        error instanceof Error ? error.message : "Facebook login failed"
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
            <SiFacebook className="h-4 w-4 text-blue-600" />{" "}
            <span className="grow text-center font-normal">
              Sign in with Facebook
            </span>{" "}
          </Button>
        </div>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </>
  )
}

export default FacebookAuth
