"use client"

import { useEffect, useState } from "react"
import { SiFacebook } from "@icons-pack/react-simple-icons"
import { useTurnkey } from "@turnkey/react-wallet-kit"

import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"

const FacebookAuth = () => {
  const { handleFacebookOauth, clientState } = useTurnkey()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(!!clientState)
  }, [clientState])

  const onClick = async () => {
    await handleFacebookOauth({ openInPage: false })
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
