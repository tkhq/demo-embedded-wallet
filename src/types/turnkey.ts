import { TurnkeyApiTypes } from "@turnkey/http"

export type Attestation = TurnkeyApiTypes["v1Attestation"]

export type Email = `${string}@${string}.${string}`

// A single asset balance as returned by Turnkey's Balances API
// (getWalletAddressBalances). `balance` is in atomic units; `display` values
// are for presentation only (do not use for arithmetic).
export type AssetBalance = {
  caip19?: string
  symbol?: string
  name?: string
  balance?: string
  decimals?: number
  display?: {
    usd?: string
    crypto?: string
  }
}

export type Account = Omit<
  TurnkeyApiTypes["v1GetWalletAccountsResponse"]["accounts"][number],
  "address"
> & {
  // A checksummed EVM address (0x…) or a base58 Solana address. `addressFormat`
  // (kept from the base type) identifies which chain the account belongs to.
  address: string
  // Native balance in the chain's atomic units (wei for ETH, lamports for SOL),
  // derived from the Turnkey Balances API.
  balance: bigint | undefined
  // Full per-asset balance list from the Turnkey Balances API.
  balances?: AssetBalance[]
}
export type Wallet =
  TurnkeyApiTypes["v1GetWalletsResponse"]["wallets"][number] & {
    accounts: Account[]
  }

export type UserSession = {
  id: string
  name: string
  email: string
  organization: {
    organizationId: string
    organizationName: string
  }
}

export type Authenticator =
  TurnkeyApiTypes["v1GetAuthenticatorsResponse"]["authenticators"][number]

export interface ReadOnlySession {
  session: string
  sessionExpiry: number
}

export type OauthProviderParams = TurnkeyApiTypes["v1OauthProviderParams"]
