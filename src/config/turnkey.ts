import { TurnkeyProviderConfig } from "@turnkey/react-wallet-kit"

import { env } from "@/env.mjs"

const {
  NEXT_PUBLIC_ORGANIZATION_ID,
  NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_AUTH_PROXY_URL,
  NEXT_PUBLIC_AUTH_PROXY_ID,
  NEXT_PUBLIC_FACEBOOK_CLIENT_ID,
  NEXT_PUBLIC_OAUTH_REDIRECT_URI,
} = env

// OAuth config assembled from env. Two independent knobs:
//
// 1. Facebook App ID — configured in-code (Google/Apple come from the Auth
//    Proxy dashboard; Facebook's client ID is supplied here). The SDK runs the
//    full PKCE flow + code exchange client-side; no secret, no backend. Setting
//    it also surfaces the Facebook button (`facebookOauthEnabled`).
//
// 2. Redirect override — `oauthRedirectUri` is a SINGLE value shared by every
//    provider (Google/Apple/Facebook…), not Facebook-specific. When unset it
//    inherits the Auth Proxy dashboard's `oauthRedirectUrl` (what Google/Apple
//    already use). Set NEXT_PUBLIC_OAUTH_REDIRECT_URI (e.g. in .env.local) to
//    redirect all providers back to your dev origin for local testing; that URL
//    must be whitelisted in each enabled provider's console.
const oauthConfig = {
  ...(NEXT_PUBLIC_FACEBOOK_CLIENT_ID && {
    facebook: { primaryClientId: NEXT_PUBLIC_FACEBOOK_CLIENT_ID },
  }),
  ...(NEXT_PUBLIC_OAUTH_REDIRECT_URI && {
    oauthRedirectUri: NEXT_PUBLIC_OAUTH_REDIRECT_URI,
  }),
}

const facebookOauth = {
  auth: Object.keys(oauthConfig).length ? { oauthConfig } : {},
  ui: NEXT_PUBLIC_FACEBOOK_CLIENT_ID
    ? { authModal: { methods: { facebookOauthEnabled: true } } }
    : {},
}

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
    // wallet_kit_config, so they are intentionally not set here — with the
    // exception of Facebook (see `facebookOauth` above), which the dashboard
    // does not support and is therefore configured in-code.
    ...facebookOauth.auth,
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
  // pattern; the Developer Mode panel mutates a copy of this config at runtime.
  // Auth-method visibility (ui.authModal.methods) is intentionally left unset so
  // it defaults to whatever is enabled in the Auth Proxy dashboard config; the
  // Dev Mode panel can override it live. Facebook is the exception (see
  // `facebookOauth` above): its button is surfaced only when an App ID is set,
  // since it's configured in-code rather than via the dashboard.
  ui: {
    darkMode: false,
    borderRadius: "12px",
    ...facebookOauth.ui,
  },
}
