"use client"

import { useEffect, useState } from "react"
import { useTurnkey } from "@turnkey/sdk-react"
import { sha256 } from "viem"

import { env } from "@/env.mjs"
import { siteConfig } from "@/config/site"

import { generateChallengePair } from "../lib/facebook-utils"
import { Skeleton } from "./ui/skeleton"

const FacebookAuth = () => {
  const { authIframeClient } = useTurnkey()

  const [nonce, setNonce] = useState<string>("")

  const redirectURI = `${siteConfig.url.base}/facebook-callback`

  const clientID = env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID

  // Generate nonce based on iframePublicKey
  useEffect(() => {
    if (authIframeClient?.iframePublicKey) {
      const hashedPublicKey = sha256(
        authIframeClient.iframePublicKey as `0x${string}`
      ).replace(/^0x/, "")

      setNonce(hashedPublicKey)
    }
  }, [authIframeClient?.iframePublicKey])

  const redirectToFacebook = async () => {
    const { verifier, codeChallenge } = await generateChallengePair()

    const codeChallengeMethod = "sha256"

    // Generate the Facebook OAuth URL server-side
    const params = new URLSearchParams({
      client_id: clientID,
      redirect_uri: redirectURI,
      state: verifier,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      nonce: nonce,
      scope: "openid",
      response_type: "code",
    } as any)

    const facebookOAuthURL = `https://www.facebook.com/v11.0/dialog/oauth?${params.toString()}`
    window.location.href = facebookOAuthURL
  }

  return (
    <>
      {nonce ? (
        <div className="flex w-full justify-center">
          <button onClick={redirectToFacebook}>Login with Facebook</button>
        </div>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </>
  )
}

export default FacebookAuth
