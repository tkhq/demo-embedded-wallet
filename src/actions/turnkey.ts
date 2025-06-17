"use server"

import { OtpType } from "@turnkey/sdk-react"
import {
  ApiKeyStamper,
  DEFAULT_ETHEREUM_ACCOUNTS,
  TurnkeyServerClient,
} from "@turnkey/sdk-server"
import { WalletType } from "@turnkey/wallet-stamper"
import { decode, JwtPayload } from "jsonwebtoken"
import { Address, getAddress, parseEther } from "viem"

import { env } from "@/env.mjs"
import {
  Attestation,
  Email,
  OauthProviderParams,
  Wallet,
} from "@/types/turnkey"
import { siteConfig } from "@/config/site"
import { turnkeyConfig } from "@/config/turnkey"
import { getTurnkeyWalletClient } from "@/lib/web3"

import { getTransactions } from "./web3"

const {
  TURNKEY_API_PUBLIC_KEY,
  TURNKEY_API_PRIVATE_KEY,
  TURNKEY_WARCHEST_API_PUBLIC_KEY,
  TURNKEY_WARCHEST_API_PRIVATE_KEY,
  TURNKEY_WARCHEST_ORGANIZATION_ID,
  WARCHEST_PRIVATE_KEY_ID,
} = env

const stamper = new ApiKeyStamper({
  apiPublicKey: TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: TURNKEY_API_PRIVATE_KEY,
})

const client = new TurnkeyServerClient({
  apiBaseUrl: turnkeyConfig.apiBaseUrl,
  organizationId: turnkeyConfig.organizationId,
  stamper,
})

function decodeJwt(credential: string): JwtPayload | null {
  const decoded = decode(credential)

  if (decoded && typeof decoded === "object" && "email" in decoded) {
    return decoded as JwtPayload
  }

  return null
}

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

export const createUserSubOrg = async ({
  email,
  passkey,
  oauth,
  wallet,
}: {
  email?: Email
  passkey?: {
    challenge: string
    attestation: Attestation
  }
  oauth?: OauthProviderParams
  wallet?: {
    publicKey: string
    type: WalletType
  }
}) => {
  const authenticators = passkey
    ? [
        {
          authenticatorName: "Passkey",
          challenge: passkey.challenge,
          attestation: passkey.attestation,
        },
      ]
    : []

  const oauthProviders = oauth
    ? [
        {
          providerName: oauth.providerName,
          oidcToken: oauth.oidcToken,
        },
      ]
    : []

  const apiKeys = wallet
    ? [
        {
          apiKeyName: "Wallet Auth - Embedded Wallet",
          publicKey: wallet.publicKey,
          curveType:
            wallet.type === WalletType.Ethereum
              ? ("API_KEY_CURVE_SECP256K1" as const)
              : ("API_KEY_CURVE_ED25519" as const),
        },
      ]
    : []

  let userEmail = email
  // If the user is logging in with a Google Auth credential, use the email from the decoded OIDC token (credential
  // Otherwise, use the email from the email parameter
  if (oauth) {
    const decoded = decodeJwt(oauth.oidcToken)
    if (decoded?.email) {
      userEmail = decoded.email
    }
  }
  const subOrganizationName = `Sub Org - ${email}`
  const userName = email ? email.split("@")?.[0] || email : ""

  const subOrg = await client.createSubOrganization({
    organizationId: turnkeyConfig.organizationId,
    subOrganizationName,
    rootUsers: [
      {
        userName,
        userEmail,
        oauthProviders,
        authenticators,
        apiKeys,
      },
    ],
    rootQuorumThreshold: 1,
    wallet: {
      walletName: "Default Wallet",
      accounts: DEFAULT_ETHEREUM_ACCOUNTS,
    },
  })
  const userId = subOrg.rootUserIds?.[0]
  if (!userId) {
    throw new Error("No root user ID found")
  }
  const { user } = await client.getUser({
    organizationId: subOrg.subOrganizationId,
    userId,
  })

  return { subOrg, user }
}

export const oauth = async ({
  credential,
  publicKey,
  subOrgId,
}: {
  credential: string
  publicKey: string
  subOrgId: string
}) => {
  const oauthResponse = await client.oauthLogin({
    oidcToken: credential,
    publicKey,
    organizationId: subOrgId,
  })

  return {
    userId: oauthResponse.activity.votes[0]?.userId,
    session: oauthResponse.session,
    organizationId: subOrgId,
  }
}

const getMagicLinkTemplate = (
  action: string,
  email: string,
  method: string,
  publicKey: string
) =>
  `${siteConfig.url.base}/email-${action}?userEmail=${email}&continueWith=${method}&publicKey=${publicKey}&credentialBundle=%s`

export const initEmailAuth = async ({
  email,
  targetPublicKey,
}: {
  email: Email
  targetPublicKey: string
}) => {
  let organizationId = await getSubOrgIdByEmail(email as Email)
  if (!organizationId) {
    const { subOrg } = await createUserSubOrg({
      email: email as Email,
    })
    organizationId = subOrg.subOrganizationId
  }

  const magicLinkTemplate = getMagicLinkTemplate(
    "auth",
    email,
    "email",
    targetPublicKey
  )

  if (organizationId?.length) {
    const authResponse = await client.initOtp({
      userIdentifier: targetPublicKey,
      otpType: OtpType.Email,
      contact: email,
      emailCustomization: {
        magicLinkTemplate,
      },
    })
    return authResponse
  }
}

export const verifyOtp = async ({
  otpId,
  otpCode,
  publicKey,
}: {
  otpId: string
  otpCode: string
  publicKey: string
}) => {
  const authResponse = await client.verifyOtp({
    otpId,
    otpCode,
  })

  return authResponse
}

export const otpLogin = async ({
  publicKey,
  verificationToken,
  email,
}: {
  publicKey: string
  verificationToken: string
  email: Email
}) => {
  const subOrgId = await getSubOrgIdByEmail(email)

  const sessionResponse = await client.otpLogin({
    verificationToken,
    publicKey,
    organizationId: subOrgId,
  })

  return {
    userId: sessionResponse.activity.votes[0]?.userId,
    session: sessionResponse.session,
    organizationId: subOrgId,
  }
}

type EmailParam = { email: Email }
type PublicKeyParam = { publicKey: string }
type UsernameParam = { username: string }
type OidcTokenParam = { oidcToken: string }

export function getSubOrgId(param: EmailParam): Promise<string>
export function getSubOrgId(param: PublicKeyParam): Promise<string>
export function getSubOrgId(param: UsernameParam): Promise<string>
export function getSubOrgId(param: OidcTokenParam): Promise<string>

export async function getSubOrgId(
  param: EmailParam | PublicKeyParam | UsernameParam | OidcTokenParam
): Promise<string> {
  let filterType: string
  let filterValue: string

  if ("email" in param) {
    filterType = "EMAIL"
    filterValue = param.email
  } else if ("publicKey" in param) {
    filterType = "PUBLIC_KEY"
    filterValue = param.publicKey
  } else if ("username" in param) {
    filterType = "USERNAME"
    filterValue = param.username
  } else if ("oidcToken" in param) {
    filterType = "OIDC_TOKEN"
    filterValue = param.oidcToken
  } else {
    throw new Error("Invalid parameter")
  }

  const { organizationIds } = await client.getSubOrgIds({
    organizationId: turnkeyConfig.organizationId,
    filterType,
    filterValue,
  })

  return organizationIds[0]
}

export const getSubOrgIdByEmail = async (email: Email) => {
  return getSubOrgId({ email })
}

export const getSubOrgIdByPublicKey = async (publicKey: string) => {
  return getSubOrgId({ publicKey })
}

export const getSubOrgIdByUsername = async (username: string) => {
  return getSubOrgId({ username })
}

export const getUser = async (userId: string, subOrgId: string) => {
  return client.getUser({
    organizationId: subOrgId,
    userId,
  })
}

export async function getWalletsWithAccounts(
  organizationId: string
): Promise<Wallet[]> {
  const { wallets } = await client.getWallets({
    organizationId,
  })

  return await Promise.all(
    wallets.map(async (wallet) => {
      const { accounts } = await client.getWalletAccounts({
        organizationId,
        walletId: wallet.walletId,
      })

      const accountsWithBalance = await Promise.all(
        accounts
          .filter((account) => account.curve === "CURVE_SECP256K1")
          .map(async ({ address, ...account }) => {
            return {
              ...account,
              address: getAddress(address),
              balance: undefined,
            }
          })
      )
      return { ...wallet, accounts: accountsWithBalance }
    })
  )
}

export const getWallet = async (
  walletId: string,
  organizationId: string
): Promise<Wallet> => {
  const [{ wallet }, accounts] = await Promise.all([
    client.getWallet({ walletId, organizationId }),
    client
      .getWalletAccounts({ walletId, organizationId })
      .then(({ accounts }) =>
        accounts.map(({ address, ...account }) => {
          return {
            ...account,
            address: getAddress(address),
            balance: undefined,
          }
        })
      ),
  ])

  return { ...wallet, accounts }
}

export const getAuthenticators = async (userId: string, subOrgId: string) => {
  const { authenticators } = await client.getAuthenticators({
    organizationId: subOrgId,
    userId,
  })
  return authenticators
}

export const getAuthenticator = async (
  authenticatorId: string,
  subOrgId: string
) => {
  const { authenticator } = await client.getAuthenticator({
    organizationId: subOrgId,
    authenticatorId,
  })
  return authenticator
}

const warchestStamper = new ApiKeyStamper({
  apiPublicKey: TURNKEY_WARCHEST_API_PUBLIC_KEY,
  apiPrivateKey: TURNKEY_WARCHEST_API_PRIVATE_KEY,
})

const warchestClient = new TurnkeyServerClient({
  apiBaseUrl: turnkeyConfig.apiBaseUrl,
  organizationId: TURNKEY_WARCHEST_ORGANIZATION_ID,
  stamper: warchestStamper,
})

export const fundWallet = async (address: Address) => {
  const value = parseEther("0.01")
  const { receivedTransactions } = await getTransactions(address)

  if (receivedTransactions.length >= 1) {
    return ""
  }

  const walletClient = await getTurnkeyWalletClient(
    warchestClient as TurnkeyServerClient,
    WARCHEST_PRIVATE_KEY_ID
  )

  const txHash = await walletClient.sendTransaction({
    to: address,
    value,
  })

  return txHash
}
