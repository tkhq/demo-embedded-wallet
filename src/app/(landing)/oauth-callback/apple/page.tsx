"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useTurnkey } from "@turnkey/sdk-react"
import { Loader } from "lucide-react"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"

function OAuthProcessCallback() {
  const { authIframeClient } = useTurnkey()
  const { loginWithApple } = useAuth()
  const router = useRouter()

  const [storedToken, setStoredToken] = useState<string | null>(null) // Store the token locally
  const [hasLoggedIn, setHasLoggedIn] = useState(false) // Track if loginWithOAuth has been called

  // Get token from query string params and store in state when available
  useEffect(() => {
    const fragment = window.location.hash
    if (fragment) {
      const params = new URLSearchParams(fragment.slice(1)) // Remove the "#" and parse parameters
      const token = params.get("id_token")
      if (!token) {
        const msg = "Invalid redirect parameters"
        router.push(`/?error=${encodeURIComponent(msg)}`)
        return
      }
      setStoredToken(token) // Store token if available
    } else {
      const msg = "Invalid redirect parameters"
      router.push(`/?error=${encodeURIComponent(msg)}`)
    }
  }, [router])

  // Trigger loginWithOAuth when both token and iframePublicKey are available, but only once
  useEffect(() => {
    if (storedToken && authIframeClient?.iframePublicKey && !hasLoggedIn) {
      try {
        // Call the OAuth login function with the stored token
        loginWithApple(storedToken)

        // Set flag to prevent further calls
        setHasLoggedIn(true)
      } catch (error) {
        const msg = "Error logging in with Apple: " + error
        router.push(`/?error=${encodeURIComponent(msg)}`)
      }
    }
  }, [
    storedToken,
    authIframeClient?.iframePublicKey,
    hasLoggedIn,
    loginWithApple,
  ])

  return (
    <main className="flex w-full flex-col items-center justify-center">
      <Card className="mx-auto h-full w-full sm:w-1/2">
        <CardHeader className="space-y-4">
          <Icons.turnkey className="h-12 w-full stroke-0 py-2 dark:stroke-white sm:h-14" />
          <CardTitle className="flex  items-center justify-center text-center">
            <div className="flex items-center gap-2">
              <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-base">Redirecting...</span>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>
    </main>
  )
}

export default function OAuth() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OAuthProcessCallback />
    </Suspense>
  )
}
