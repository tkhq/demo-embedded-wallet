"use client"

import { TurnkeyConfigProvider } from "./config/config-provider"
import { ThemeProvider } from "./theme-provider"

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
    <TurnkeyConfigProvider>{children}</TurnkeyConfigProvider>
  </ThemeProvider>
)
