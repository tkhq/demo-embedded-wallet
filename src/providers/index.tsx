"use client"

import { TurnkeyProvider } from "@turnkey/sdk-react"
import { EthereumWallet } from "@turnkey/wallet-stamper"

import { turnkeyConfig } from "@/config/turnkey"

import { AuthProvider } from "./auth-provider"
import { ThemeProvider } from "./theme-provider"

const wallet = new EthereumWallet()

// Helper to get current hostname in runtime; falls back to configured value during SSR.
const getRuntimeRpId = () =>
  typeof window !== "undefined"
    ? window.location.hostname
    : turnkeyConfig.passkey.rpId

export const Providers: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="light"
    forcedTheme="light"
    enableSystem={false}
    disableTransitionOnChange
  >
    <TurnkeyProvider
      config={{
        rpId: getRuntimeRpId(),
        apiBaseUrl: turnkeyConfig.apiBaseUrl,
        defaultOrganizationId: turnkeyConfig.organizationId,
        wallet: wallet,
      }}
    >
      <AuthProvider> {children}</AuthProvider>
    </TurnkeyProvider>
  </ThemeProvider>
)
