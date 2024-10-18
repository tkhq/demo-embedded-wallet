"use server"

import { env } from "@/env.mjs"
import { siteConfig } from "@/config/site"

export async function exchangeToken(code: string, codeVerifier: string) {
  const graphAPIVersion = env.NEXT_PUBLIC_FACEBOOK_GRAPH_API_VERSION
  const url = `https://graph.facebook.com/v${graphAPIVersion}/oauth/access_token`

  const clientID = env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID
  const redirectURI = `${siteConfig.url.base}/oauth-callback/facebook`

  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: redirectURI,
    code: code,
    code_verifier: codeVerifier,
  })

  try {
    const target = `${url}?${params.toString()}`

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
