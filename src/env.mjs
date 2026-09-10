import { vercel } from "@t3-oss/env-core/presets-zod"
import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

// This demo is backendless: authentication (OTP/OAuth/passkey), which auth
// methods are shown, OAuth client IDs, session length, etc. are all managed on
// the Turnkey dashboard (Embedded Wallets → Configuration) and served to the
// SDK via the Auth Proxy's wallet_kit_config. Balances and transactions are
// signed client-side against the user's session. As a result the app only needs
// two required env vars, plus optional API/proxy URL overrides.
export const env = createEnv({
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  client: {
    // Your parent organization ID (Turnkey dashboard).
    NEXT_PUBLIC_ORGANIZATION_ID: z.string().min(1),
    // Auth Proxy config ID (Turnkey dashboard → Embedded Wallets → Configuration).
    NEXT_PUBLIC_AUTH_PROXY_ID: z.string().min(1),
    // Optional overrides — omit to use Turnkey defaults
    // (https://api.turnkey.com and https://authproxy.turnkey.com).
    NEXT_PUBLIC_BASE_URL: z.string().min(1).optional(),
    NEXT_PUBLIC_AUTH_PROXY_URL: z.string().min(1).optional(),
    // Optional: Facebook OAuth App ID. Configured in-code (unlike Google/Apple,
    // which come from the Auth Proxy dashboard). The App ID is public — not a
    // secret — and the SDK runs the PKCE flow + code exchange client-side. Leave
    // unset to hide the Facebook button.
    NEXT_PUBLIC_FACEBOOK_CLIENT_ID: z.string().min(1).optional(),
    // Optional: override the OAuth redirect URL. This is a SINGLE value shared
    // by ALL providers (Google/Apple/Facebook…), not Facebook-specific. Leave
    // unset in prod to inherit the Auth Proxy dashboard's redirect; set it in
    // .env.local (e.g. http://localhost:3000/) so OAuth popups redirect back to
    // your dev origin. Whatever value you use must be whitelisted in each
    // enabled provider's console.
    NEXT_PUBLIC_OAUTH_REDIRECT_URI: z.string().min(1).optional(),
    // Optional (dev/demo only): the PUBLIC key of the "Policy Manager" P-256
    // API keypair, used by the Dev Mode "Add Policy Manager as root user"
    // action to make a sub-org a 2/2 co-signing setup. Only the PUBLIC half
    // belongs here — it is safe to expose. The PRIVATE half must NEVER be a
    // NEXT_PUBLIC_ var; keep it in a secret store and only load it server-side
    // when Policy Manager actually signs/approves. Leave unset to hide the
    // action.
    NEXT_PUBLIC_POLICY_MANAGER_PUBLIC_KEY: z.string().min(1).optional(),
  },
  server: {},
  runtimeEnv: {
    NEXT_PUBLIC_ORGANIZATION_ID: process.env.NEXT_PUBLIC_ORGANIZATION_ID,
    NEXT_PUBLIC_AUTH_PROXY_ID: process.env.NEXT_PUBLIC_AUTH_PROXY_ID,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_AUTH_PROXY_URL: process.env.NEXT_PUBLIC_AUTH_PROXY_URL,
    NEXT_PUBLIC_FACEBOOK_CLIENT_ID: process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID,
    NEXT_PUBLIC_OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI,
    NEXT_PUBLIC_POLICY_MANAGER_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_POLICY_MANAGER_PUBLIC_KEY,
  },
  extends: [vercel()],
})
