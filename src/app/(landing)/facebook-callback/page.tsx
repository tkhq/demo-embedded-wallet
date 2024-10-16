"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useTurnkey } from "@turnkey/sdk-react"
import { Loader } from "lucide-react"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"

import { exchangeToken } from "./exchange-token"

function FacebookProcessCallback() {
  const searchParams = useSearchParams()

  const { authIframeClient } = useTurnkey()
  const { loginWithFacebook } = useAuth()

  const [storedCode, setStoredCode] = useState<string | null>(null) // Store the token locally
  const [hasLoggedIn, setHasLoggedIn] = useState(false) // Track if loginWithOAuth has been called

  const getToken = async () => {
    const codeVerifier =
      "lqRVABO1ifZALKrJ3VZAmASUzuulW7sLkfYVhpwlmwPVUPkPmbvkhBlP3t6TgPHlOr6lmbmSZBBz9L2QFRcmOZCVaSiQWZBRsRxn" // Replace with your generated code_challenge

    const token = await exchangeToken(storedCode || "", codeVerifier)

    console.log("got token!")
    console.log(token)

    return token
  }

  // Get token from query string params and store in state when available
  useEffect(() => {
    const code = searchParams.get("code")
    const verifier = searchParams.get("verifier")
    if (code) {
      setStoredCode(code) // Store token if available
    }
  }, [searchParams])

  // Trigger loginWithOAuth when both token and iframePublicKey are available, but only once
  useEffect(() => {
    const handleTokenExchange = async () => {
      try {
        // Get the token asynchronously
        const token = await getToken()

        // Perform the Facebook login with the token
        loginWithFacebook(token)

        // Set flag to prevent further calls
        setHasLoggedIn(true)
      } catch (error) {
        console.error("Error during token exchange:", error)
      }
    }

    if (storedCode && authIframeClient?.iframePublicKey && !hasLoggedIn) {
      // Call the async handler to exchange the token
      handleTokenExchange()
    }
  }, [
    storedCode,
    authIframeClient?.iframePublicKey,
    hasLoggedIn,
    loginWithFacebook,
    getToken,
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

export default function Facebook() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FacebookProcessCallback />
    </Suspense>
  )
}
