"use server"

import { env } from "@/env.mjs"

export async function exchangeToken(code: string, codeVerifier: string) {
  const url = "https://graph.facebook.com/v21.0/oauth/access_token"

  const redirectURI = `${env.NEXT_PUBLIC_APP_URL}/facebook-callback`
  const clientID = env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID

  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: redirectURI,
    code: code,
    code_verifier: codeVerifier,
  })

  try {
    const target = `${url}?${params.toString()}`

    console.log(target)

    return ""

    const response = await fetch(target, {
      method: "GET",
    })

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`)
    }

    const data = await response.json()

    // Extract id_token from the response
    const idToken = data.id_token
    if (!idToken) {
      throw new Error("id_token not found in response")
    }

    return idToken
  } catch (error) {
    throw error
  }
}
