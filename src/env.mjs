import { vercel } from "@t3-oss/env-core/presets"
import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  client: {
    NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
    NEXT_PUBLIC_RP_ID: z.string().optional(),
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_BASE_URL: z.string().min(1),
    NEXT_PUBLIC_ORGANIZATION_ID: z.string().min(1),
    NEXT_PUBLIC_ALCHEMY_API_KEY: z.string().min(1),
  },
  server: {
    NEXT_PUBLIC_RP_ID: z.string().optional(),
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    TURNKEY_API_PUBLIC_KEY: z.string().min(1),
    TURNKEY_API_PRIVATE_KEY: z.string().min(1),
    NEXT_PUBLIC_BASE_URL: z.string().min(1),
    NEXT_PUBLIC_ORGANIZATION_ID: z.string().min(1),
    NEXT_PUBLIC_ALCHEMY_API_KEY: z.string().min(1),
    COINGECKO_API_KEY: z.string().min(1),
    TURNKEY_WARCHEST_API_PUBLIC_KEY: z.string().min(1),
    TURNKEY_WARCHEST_API_PRIVATE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
    NEXT_PUBLIC_RP_ID: process.env.NEXT_PUBLIC_RP_ID,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
      process.env.NEXT_PUBLIC_VERCEL_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    TURNKEY_API_PUBLIC_KEY: process.env.TURNKEY_API_PUBLIC_KEY,
    TURNKEY_API_PRIVATE_KEY: process.env.TURNKEY_API_PRIVATE_KEY,
    NEXT_PUBLIC_ORGANIZATION_ID: process.env.NEXT_PUBLIC_ORGANIZATION_ID,
    NEXT_PUBLIC_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
    TURNKEY_WARCHEST_API_PUBLIC_KEY:
      process.env.TURNKEY_WARCHEST_API_PUBLIC_KEY,
    TURNKEY_WARCHEST_API_PRIVATE_KEY:
      process.env.TURNKEY_WARCHEST_API_PRIVATE_KEY,
  },
  extends: [vercel()],
})
