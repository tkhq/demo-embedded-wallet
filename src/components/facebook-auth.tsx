"use client"

import { useEffect, useState } from "react"
import { SiFacebook } from "@icons-pack/react-simple-icons"
import { useTurnkey } from "@turnkey/sdk-react"
import { sha256 } from "viem"

import { env } from "@/env.mjs"
import { siteConfig } from "@/config/site"

import { generateChallengePair } from "../lib/facebook-utils"
import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"

const FacebookAuth = () => {
  const { authIframeClient } = useTurnkey()

  const [nonce, setNonce] = useState<string>("")

  const redirectURI = `${siteConfig.url.base}/oauth-callback/facebook`

  const clientID = env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID

  const authAPIVersion = env.NEXT_PUBLIC_FACEBOOK_AUTH_VERSION

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

    const facebookOAuthURL = `https://www.facebook.com/v${authAPIVersion}/dialog/oauth?${params.toString()}`
    window.location.href = facebookOAuthURL
  }

  return (
    <>
      {nonce ? (
        <div className="flex w-full justify-center">
          <Button
            variant="outline"
            className="flex w-[235px] items-center justify-between"
            onClick={redirectToFacebook}
          >
            <SiFacebook className="h-4 w-4 text-blue-600" />{" "}
            <span className="flex-grow text-center font-normal">
              Sign in with Facebook
            </span>{" "}
          </Button>
        </div>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </>
  )
}

export default FacebookAuth
