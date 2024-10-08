"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useTurnkey } from "@turnkey/sdk-react"
import AppleLogin from "react-apple-login"
import { sha256 } from "viem"

import { env } from "@/env.mjs"

import { Skeleton } from "./ui/skeleton"

const AppleAuth = ({ loading }: { loading: boolean }) => {
  const clientId = env.NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID
  const redirectURI = `${env.NEXT_PUBLIC_APP_URL}/oauth-callback`

  const { authIframeClient } = useTurnkey()
  const { loginWithOAuth } = useAuth()

  const [nonce, setNonce] = useState<string>("")
  const [storedToken, setStoredToken] = useState<string | null>(null) // Store the token locally
  const [hasLoggedIn, setHasLoggedIn] = useState(false) // Track if loginWithOAuth has been called

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
        <AppleLogin
          clientId={clientId}
          redirectURI={redirectURI as string}
          responseType="code id_token"
          nonce={nonce}
          responseMode="fragment"
        />
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </>
  )
}

export default AppleAuth
