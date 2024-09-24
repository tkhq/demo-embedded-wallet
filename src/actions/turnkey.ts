"use server"

import {
  ApiKeyStamper,
  DEFAULT_ETHEREUM_ACCOUNTS,
  TurnkeyServerClient,
} from "@turnkey/sdk-server"
import { decode, JwtPayload } from "jsonwebtoken"
import { getAddress } from "viem"

import { env } from "@/env.mjs"
import { Attestation, Email, Wallet } from "@/types/turnkey"
import { siteConfig } from "@/config/site"
import { turnkeyConfig } from "@/config/turnkey"

const { TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY } = env

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

export const createUserSubOrg = async ({
  email,
  passkey,
  oauth,
}: {
  email?: Email
  passkey?: {
    challenge: string
    attestation: Attestation
  }
  oauth?: {
    credential: string
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
          providerName: "Google Auth - Embedded Wallet",
          oidcToken: oauth.credential,
        },
      ]
    : []

  let userEmail = email
  // If the user is logging in with a Google Auth credential, use the email from the decoded OIDC token (credential
  // Otherwise, use the email from the email parameter
  if (oauth) {
    const decoded = decodeJwt(oauth.credential)
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
        apiKeys: [],
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
  targetPublicKey,
  targetSubOrgId,
}: {
  credential: string
  targetPublicKey: string
  targetSubOrgId: string
}) => {
  const oauthResponse = await client.oauth({
    oidcToken: credential,
    targetPublicKey,
    organizationId: targetSubOrgId,
  })

  return oauthResponse
}

const getMagicLinkTemplate = (action: string, email: string, method: string) =>
  `${siteConfig.url.base}/email-${action}?userEmail=${email}&continueWith=${method}&credentialBundle=%s`

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

  const magicLinkTemplate = getMagicLinkTemplate("auth", email, "email")

  if (organizationId?.length) {
    const authResponse = await client.emailAuth({
      email,
      targetPublicKey,
      organizationId,
      emailCustomization: {
        magicLinkTemplate,
      },
    })

    return authResponse
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
        accounts.map(async ({ address, ...account }) => {
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
