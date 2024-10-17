"use client"

import { useEffect, useState } from "react"
import { SiApple } from "@icons-pack/react-simple-icons"
import { useTurnkey } from "@turnkey/sdk-react"
import AppleLogin from "react-apple-login"
import { sha256 } from "viem"

import { env } from "@/env.mjs"
import { siteConfig } from "@/config/site"

import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"

const AppleAuth = () => {
  const clientId = env.NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID
  const redirectURI = `${siteConfig.url.base}/oauth-callback/apple`

  const { authIframeClient } = useTurnkey()

  const [nonce, setNonce] = useState<string>("")

  // Generate nonce based on iframePublicKey
  useEffect(() => {
    if (authIframeClient?.iframePublicKey) {
      const hashedPublicKey = sha256(
        authIframeClient.iframePublicKey as `0x${string}`
      ).replace(/^0x/, "")

      setNonce(hashedPublicKey)
    }
  }, [authIframeClient?.iframePublicKey])

  return (
    <>
      {nonce ? (
        <div className="flex w-full cursor-pointer justify-center rounded-md bg-white">
          <AppleLogin
            clientId={clientId}
            redirectURI={redirectURI}
            responseType="code id_token"
            nonce={nonce}
            responseMode="fragment"
            render={({ onClick }) => (
              <Button
                variant="outline"
                className="flex w-[235px] items-center justify-between"
                onClick={onClick}
              >
                <SiApple className="h-4 w-4" />
                <span className="flex-grow text-center font-normal">
                  Sign in with Apple
                </span>{" "}
              </Button>
            )}
          />
        </div>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </>
  )
}

export default AppleAuth
