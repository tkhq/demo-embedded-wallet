import { TurnkeyProviderConfig } from "@turnkey/react-wallet-kit"

import { env } from "@/env.mjs"

const {
  NEXT_PUBLIC_ORGANIZATION_ID,
  NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_AUTH_PROXY_URL,
  NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
  NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID,
  NEXT_PUBLIC_FACEBOOK_CLIENT_ID,
  NEXT_PUBLIC_AUTH_PROXY_ID,
} = env

// export const turnkeyConfig = {
//   apiBaseUrl: NEXT_PUBLIC_BASE_URL,
//   organizationId: NEXT_PUBLIC_ORGANIZATION_ID,
//   iFrame: {
//     // default
//     url: NEXT_PUBLIC_AUTH_IFRAME_URL ?? "https://auth.turnkey.com",
//     elementId: "turnkey-auth-iframe-element-id",
//     containerId: "turnkey-auth-iframe-container-id",
//     auth: {
//       url: NEXT_PUBLIC_AUTH_IFRAME_URL ?? "https://auth.turnkey.com",
//       containerId: "turnkey-auth-iframe-container-id",
//     },
//     export: {
//       url: NEXT_PUBLIC_EXPORT_IFRAME_URL ?? "https://export.turnkey.com",
//       containerId: "turnkey-export-iframe-container-id",
//     },
//     import: {
//       url: NEXT_PUBLIC_IMPORT_IFRAME_URL ?? "https://import.turnkey.com",
//       containerId: "turnkey-import-iframe-container-id",
//     },
//   },
//   passkey: {
//     rpId: env.NEXT_PUBLIC_RP_ID || "localhost",
//   },
//   rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
// }

const customWallet = {
  walletName: "Default Wallet",
  walletAccounts: [
    {
      curve: "CURVE_SECP256K1" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: `m/44'/60'/0'/0/0`,
      addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
    },
  ],
}

export const turnkeyConfig: TurnkeyProviderConfig = {
  organizationId: NEXT_PUBLIC_ORGANIZATION_ID,
  authProxyId: NEXT_PUBLIC_AUTH_PROXY_ID,
  authProxyUrl: NEXT_PUBLIC_AUTH_PROXY_URL,
  apiBaseUrl: NEXT_PUBLIC_BASE_URL,
  auth: {
    autoRefreshSession: true,
    oAuthConfig: {
      oAuthRedirectUri: NEXT_PUBLIC_BASE_URL,
      googleClientId: NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
      appleClientId: NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID,
      facebookClientId: NEXT_PUBLIC_FACEBOOK_CLIENT_ID,
    },
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
      oAuth: {
        userName: "OAuth User",
        customWallet,
      },
    },
  },

  // ui: {
  //   darkMode: true,
  //   borderRadius: "12px",
  //   renderModalInProvider: false,
  // },
}
