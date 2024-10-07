"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useTurnkey } from "@turnkey/sdk-react"
import AppleLogin from "react-apple-login"
import { sha256 } from "viem"

import { env } from "@/env.mjs"

import { Skeleton } from "./ui/skeleton"

// @todo: these will be used once we can create a custom google login button
const AppleAuth = () => {
  const { authIframeClient } = useTurnkey()

  const [nonce, setNonce] = useState("")
  const { loginWithOAuth } = useAuth()

  const searchParams = useSearchParams()
  const token = searchParams.get("id_token")

  useEffect(() => {
    if (authIframeClient?.iframePublicKey) {
      const hashedPublicKey = sha256(
        authIframeClient.iframePublicKey as `0x${string}`
      ).replace(/^0x/, "")

      setNonce(hashedPublicKey)
    }
    if (
      typeof token !== undefined &&
      token !== null &&
      authIframeClient?.iframePublicKey !== undefined
    ) {
      console.log("we have a valid token")
      console.log(token)
      console.log(authIframeClient.iframePublicKey)
      loginWithOAuth(token as string)
    }
  }, [authIframeClient?.iframePublicKey, token])

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
