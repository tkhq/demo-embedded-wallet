"use server"

import crypto from "crypto"

import { env } from "@/env.mjs"

export const generateChallengePair = async (): Promise<{
  nonce: string
  codeChallenge: string
}> => {
  // Step 1: Generate a random 48-character nonce
  const nonce = crypto.randomBytes(32).toString("base64url") // URL-safe Base64 string

  // Step 2: Hash the nonce plus a salt to get the (private) verifier
  const verifier = await nonceToVerifier(nonce)

  // Step 3: Hash the verifier to get the code challenge
  const codeChallenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url")

  // Return both the nonce and the codeChallenge to the client; the nonce will be used
  // later to reconstruct the verifier during the token exchange
  return { nonce, codeChallenge }
}

export const nonceToVerifier = async (segment: string): Promise<string> => {
  const salt = env.FACEBOOK_SECRET_SALT
  const saltedVerifier = segment + salt

  return crypto.createHash("sha256").update(saltedVerifier).digest("base64url")
}
