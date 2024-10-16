"use server"

import { env } from "@/env.mjs"

export async function exchangeToken(code: string, codeVerifier: string) {
  const url = "https://graph.facebook.com/v21.0/oauth/access_token"

  const redirectURI = `${env.NEXT_PUBLIC_APP_URL}/facebook-callback`
  const clientID = env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID

  // Create URLSearchParams with the required parameters
  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: redirectURI,
    code: code,
    code_verifier: codeVerifier,
  })

  try {
    const target = `${url}?${params.toString()}`

    // Perform a GET request with the params appended to the URL
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
    console.error("Error during token exchange:", error)
    throw error
  }
}
