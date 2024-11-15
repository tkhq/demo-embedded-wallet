"use client"

import { TurnkeyProvider } from "@turnkey/sdk-react"
import { EthereumWallet } from "@turnkey/wallet-stamper"

import { turnkeyConfig } from "@/config/turnkey"

import { AuthProvider } from "./auth-provider"
import { ThemeProvider } from "./theme-provider"

const wallet = new EthereumWallet()

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
        rpId: turnkeyConfig.passkey.rpId,
        apiBaseUrl: turnkeyConfig.apiBaseUrl,
        defaultOrganizationId: turnkeyConfig.organizationId,
        wallet: wallet,
      }}
    >
      <AuthProvider> {children}</AuthProvider>
    </TurnkeyProvider>
  </ThemeProvider>
)
