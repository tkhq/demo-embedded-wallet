"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useTurnkey } from "@turnkey/sdk-react"
import AppleLogin from "react-apple-login"
import { sha256 } from "viem"

const AppleAuth = () => {
  const { authIframeClient } = useTurnkey()
  const { loginWithOAuth } = useAuth()

  const [nonce, setNonce] = useState<string>("")
  const [storedToken, setStoredToken] = useState<string | null>(null) // Store the token locally
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

  // Trigger loginWithOAuth when both token and iframePublicKey are available
  useEffect(() => {
    if (storedToken && authIframeClient?.iframePublicKey) {
      console.log("Both token and iframePublicKey are available")
      console.log("ID Token:", storedToken)
      console.log("iframePublicKey:", authIframeClient.iframePublicKey)

      // Call the OAuth login function with the stored token
      loginWithOAuth(storedToken)
    }
  }, [storedToken, authIframeClient?.iframePublicKey, loginWithOAuth])

  // Ensure nonce is set correctly before rendering AppleLogin
  if (!nonce) {
    return <div>Loading...</div> // Or some appropriate loading state
  }

  return (
    <AppleLogin
      clientId="io.turnkey.app"
      redirectURI="https://fun.turnkey.io/apple-callback"
      responseType="id_token code"
      nonce={nonce}
      responseMode="fragment"
    />
  )
}

export default AppleAuth
