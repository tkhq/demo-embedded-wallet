import { SiteConfig } from "@/types"

import { env } from "@/env.mjs"

const environment = env.NEXT_PUBLIC_VERCEL_ENV ?? "local"

const protocol = environment === "local" ? "http://" : "https://"

const baseUrl = `${protocol}${
  {
    production: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    preview:
      env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PREVIEW_URL,
    development: process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL,
    local: "localhost:3000",
  }[environment]
}`

console.group("\n URL Config:")
console.table({ baseUrl, environment, protocol })
console.groupEnd()

export const siteConfig: SiteConfig = {
  name: "Demo Embedded Wallet",
  author: "turnkey",
  description:
    "A comprehensive demo showcasing how to build an embedded wallet using Turnkey.",
  keywords: [
    "Turnkey",
    "Web3",
    "Next.js",
    "React",
    "Tailwind CSS",
    "Radix UI",
    "shadcn/ui",
  ],
  url: {
    base: baseUrl,
    author: "https://turnkey.io",
  },
  links: {
    github: "https://github.com/tkhq/demo-embedded-wallet",
  },
  ogImage: `${baseUrl}/og.jpg`,
}
