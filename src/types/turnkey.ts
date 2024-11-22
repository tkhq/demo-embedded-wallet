import { TurnkeyApiTypes, type TurnkeyClient } from "@turnkey/http"
import { Turnkey } from "@turnkey/sdk-browser"
import { Address } from "viem"

export type Attestation = TurnkeyApiTypes["v1Attestation"]

export type Email = `${string}@${string}.${string}`

export type Account = Omit<
  TurnkeyApiTypes["v1GetWalletAccountsResponse"]["accounts"][number],
  "address" | "addressFormat"
> & {
  address: Address
  balance: bigint | undefined
}
export type Wallet =
  TurnkeyApiTypes["v1GetWalletsResponse"]["wallets"][number] & {
    accounts: Account[]
  }

export type User = Awaited<ReturnType<Turnkey["getCurrentUser"]>> & {
  email?: Email
  readOnlySession?: ReadOnlySession
}

export type Authenticator =
  TurnkeyApiTypes["v1GetAuthenticatorsResponse"]["authenticators"][number]

export type PreferredWallet = {
  userId: string
  walletId: string
}

export interface ReadOnlySession {
  session: string
  sessionExpiry: number
}

export type OauthProviderParams = TurnkeyApiTypes["v1OauthProviderParams"]
