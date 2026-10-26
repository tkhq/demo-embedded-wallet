// Import the Wallet Kit stylesheet first so our own Tailwind build (globals.css)
// wins the cascade. Both are full Tailwind v4 builds that share @layer names, so
// whichever is imported last takes precedence — importing ours last keeps our
// responsive utilities (e.g. `lg:block`) intact.
import "@turnkey/react-wallet-kit/styles.css"
import "@/styles/globals.css"

import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/providers"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"] })

interface RootLayoutProps {
  children: React.ReactNode
}

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url.base),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [
    {
      name: siteConfig.author,
      url: siteConfig.url.author,
    },
  ],
  creator: siteConfig.author,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url.base,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@_rdev7",
  },
  icons: {
    icon: "/favicon.ico",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "bg-background min-h-screen antialiased",
          inter.className
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
