"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useTurnkey } from "@turnkey/sdk-react"
import AppleLogin from "react-apple-login"
import { sha256 } from "viem"

import { env } from "@/env.mjs"

import { Skeleton } from "./ui/skeleton"

const AppleAuth = () => {
  const clientId = env.NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID
  const redirectURI = env.NEXT_PUBLIC_APP_URL

  const { authIframeClient } = useTurnkey()
  const { loginWithOAuth } = useAuth()

  const [nonce, setNonce] = useState<string>("")
  const [storedToken, setStoredToken] = useState<string | null>(null) // Store the token locally
  const [hasLoggedIn, setHasLoggedIn] = useState(false) // Track if loginWithOAuth has been called

  const searchParams = useSearchParams()

  // Get token from query string params and store in state when available
  useEffect(() => {
    const token = searchParams.get("id_token")
    if (token) {
      setStoredToken(token) // Store token if available
    }
  }, [searchParams])

  // Generate nonce based on iframePublicKey
  useEffect(() => {
    if (authIframeClient?.iframePublicKey) {
      const hashedPublicKey = sha256(
        authIframeClient.iframePublicKey as `0x${string}`
      ).replace(/^0x/, "")

      setNonce(hashedPublicKey)
    }
  }, [authIframeClient?.iframePublicKey])

  // Trigger loginWithOAuth when both token and iframePublicKey are available, but only once
  useEffect(() => {
    if (storedToken && authIframeClient?.iframePublicKey && !hasLoggedIn) {
      // Call the OAuth login function with the stored token
      loginWithOAuth(storedToken)

      // Set flag to prevent further calls
      setHasLoggedIn(true)
    }
  }, [
    storedToken,
    authIframeClient?.iframePublicKey,
    hasLoggedIn,
    loginWithOAuth,
  ])

  return (
    <>
      {nonce ? (
        <AppleLogin
          clientId={clientId}
          redirectURI={redirectURI as string}
          responseType="id_token code"
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
