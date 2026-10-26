import { TurnkeyProviderConfig } from "@turnkey/react-wallet-kit"

import { env } from "@/env.mjs"

const {
  NEXT_PUBLIC_ORGANIZATION_ID,
  NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_AUTH_PROXY_URL,
  NEXT_PUBLIC_AUTH_PROXY_ID,
  NEXT_PUBLIC_OAUTH_REDIRECT_URI,
} = env

// Optional OAuth redirect override. `oauthRedirectUri` is a SINGLE value shared
// by every provider (Google/Apple/Facebook…). When unset it inherits the Auth
// Proxy dashboard's `oauthRedirectUrl`. Set NEXT_PUBLIC_OAUTH_REDIRECT_URI (e.g.
// in .env.local) to redirect all providers back to your dev origin for local
// testing; that URL must be whitelisted in each enabled provider's console.
const oauthConfig = NEXT_PUBLIC_OAUTH_REDIRECT_URI
  ? { oauthConfig: { oauthRedirectUri: NEXT_PUBLIC_OAUTH_REDIRECT_URI } }
  : {}

// New sub-orgs get a multi-chain Default Wallet: one Ethereum account
// (secp256k1) and one Solana account (ed25519), created together at sign-up.
// WalletsProvider also backfills the Solana account at runtime for wallets that
// predate it (existing users), so both paths are covered.
export const customWallet = {
  walletName: "Default Wallet",
  walletAccounts: [
    {
      curve: "CURVE_SECP256K1" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: `m/44'/60'/0'/0/0`,
      addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
    },
    {
      curve: "CURVE_ED25519" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: `m/44'/501'/0'/0'`,
      addressFormat: "ADDRESS_FORMAT_SOLANA" as const,
    },
  ],
}

export const turnkeyConfig: TurnkeyProviderConfig = {
  organizationId: NEXT_PUBLIC_ORGANIZATION_ID,
  authProxyConfigId: NEXT_PUBLIC_AUTH_PROXY_ID,
  authProxyUrl: NEXT_PUBLIC_AUTH_PROXY_URL,
  apiBaseUrl: NEXT_PUBLIC_BASE_URL,
  auth: {
    autoRefreshSession: true,
    // OAuth client IDs + redirect URL are configured on the Turnkey dashboard
    // (Embedded Wallets → Configuration) and fetched via the Auth Proxy's
    // wallet_kit_config, so they are intentionally not set here (apart from
    // the optional redirect override above).
    ...oauthConfig,
    createSuborgParams: {
      passkeyAuth: {
        userName: "Passkey User",
        passkeyName: "Default Passkey",
        customWallet,
      },
      emailOtpAuth: {
        userName: "Email User",
        customWallet,
      },
      oauth: {
        userName: "OAuth User",
        customWallet,
      },
    },
  },

  // Static, in-code UI defaults. This is the "pass a static config" reference
  // pattern; the Config Panel mutates a copy of this config at runtime.
  // Auth-method visibility (ui.authModal.methods) is intentionally left unset so
  // it defaults to whatever is enabled in the Auth Proxy dashboard config; the
  // Config Panel can override it live.
  ui: {
    darkMode: false,
    borderRadius: "12px",
  },
}
