"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useTurnkey } from "@turnkey/sdk-react"
import { Loader, Send } from "lucide-react"
import { sha256 } from "viem"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Icons } from "@/components/icons"

function OAuthProcessCallback() {
  const searchParams = useSearchParams()

  const { authIframeClient } = useTurnkey()
  const { loginWithOAuth } = useAuth()

  const [storedToken, setStoredToken] = useState<string | null>(null) // Store the token locally
  const [hasLoggedIn, setHasLoggedIn] = useState(false) // Track if loginWithOAuth has been called

  // Get token from query string params and store in state when available
  useEffect(() => {
    const token = searchParams.get("id_token")
    if (token) {
      setStoredToken(token) // Store token if available
    }
  }, [searchParams])

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

  return <div>Redirecting...</div>
}

export default function OAuth() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OAuthProcessCallback />
    </Suspense>
  )
}
