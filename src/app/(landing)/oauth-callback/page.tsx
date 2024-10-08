"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useTurnkey } from "@turnkey/sdk-react"

function OAuthProcessCallback() {
  const searchParams = useSearchParams()

  const { authIframeClient } = useTurnkey()
  const { loginWithApple } = useAuth()

  const [storedToken, setStoredToken] = useState<string | null>(null) // Store the token locally
  const [hasLoggedIn, setHasLoggedIn] = useState(false) // Track if loginWithOAuth has been called

  // Get token from query string params and store in state when available
  useEffect(() => {
    const fragment = window.location.hash
    if (fragment) {
      const params = new URLSearchParams(fragment.slice(1)) // Remove the "#" and parse parameters
      const token = params.get("id_token")
      if (token) {
        setStoredToken(token) // Store token if available
      }
    }
  }, [searchParams])

  // Trigger loginWithOAuth when both token and iframePublicKey are available, but only once
  useEffect(() => {
    if (storedToken && authIframeClient?.iframePublicKey && !hasLoggedIn) {
      // Call the OAuth login function with the stored token
      loginWithApple(storedToken)

      // Set flag to prevent further calls
      setHasLoggedIn(true)
    }
  }, [
    storedToken,
    authIframeClient?.iframePublicKey,
    hasLoggedIn,
    loginWithApple,
  ])

  return <div>Redirecting...</div>
}

export default function OAuth() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OAuthProcessCallback />
    </Suspense>
  )
}
