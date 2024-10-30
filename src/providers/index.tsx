"use client"

import { TurnkeyProvider } from "@turnkey/sdk-react"

import { turnkeyConfig } from "@/config/turnkey"
import { getWallet } from "@/lib/web3"

import { AuthProvider } from "./auth-provider"
import { ThemeProvider } from "./theme-provider"

const wallet = getWallet()

export const Providers: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="light"
    enableSystem
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
