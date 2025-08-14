"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/providers/auth-provider"
import {
  CredentialResponse,
  GoogleLogin,
  GoogleOAuthProvider,
} from "@react-oauth/google"
import { useTurnkey } from "@turnkey/sdk-react"
import { sha256 } from "viem"

import { env } from "@/env.mjs"

import { Skeleton } from "./ui/skeleton"

const GoogleAuth = () => {
  const { indexedDbClient } = useTurnkey()
  const clientId = env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID

  const [nonce, setNonce] = useState("")
  const { loginWithGoogle } = useAuth()

  useEffect(() => {
    const getPublicKey = async () => {
      const publicKey = await indexedDbClient?.getPublicKey()

      if (publicKey) {
        const hashedPublicKey = sha256(publicKey as `0x${string}`).replace(
          /^0x/,
          ""
        )

        setNonce(hashedPublicKey)
      }
    }

    getPublicKey()
  }, [indexedDbClient])

  const onSuccess = (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      loginWithGoogle(credentialResponse.credential as string)
    }
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {nonce ? (
        <GoogleLogin
          nonce={nonce}
          width={235}
          containerProps={{
            className: "w-full bg-white flex justify-center rounded-md",
          }}
          onSuccess={onSuccess}
          useOneTap={false}
          auto_select={false}
        />
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </GoogleOAuthProvider>
  )
}

export default GoogleAuth
