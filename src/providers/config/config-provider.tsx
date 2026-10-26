"use client"

import { createContext, useContext, useMemo, useState } from "react"
import {
  TurnkeyProvider,
  TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit"

import { turnkeyConfig as defaultConfig } from "@/config/turnkey"
import { cn } from "@/lib/utils"
import { ConfigPanel } from "@/components/config-panel"
import { PROVISION_MARKER } from "@/components/provision-on-signup"

type TurnkeyConfigContextType = {
  config: TurnkeyProviderConfig
  setConfig: (
    updater: (prev: TurnkeyProviderConfig) => TurnkeyProviderConfig
  ) => void
  configPanelOpen: boolean
  setConfigPanelOpen: (value: boolean) => void
}

const TurnkeyConfigContext = createContext<
  TurnkeyConfigContextType | undefined
>(undefined)

export function useTurnkeyConfig() {
  const ctx = useContext(TurnkeyConfigContext)
  if (!ctx) {
    throw new Error(
      "useTurnkeyConfig must be used within a TurnkeyConfigProvider"
    )
  }
  return ctx
}

/**
 * Owns the (mutable) TurnkeyProviderConfig and renders the TurnkeyProvider with
 * it. This mirrors the `wallets.turnkey.com` reference demo's runtime-config
 * pattern: the config starts from the static `turnkeyConfig` and can be mutated
 * live by the Config Panel. Mutating the config re-initializes the
 * Turnkey client (sessions persist via storage), which is acceptable for a demo.
 *
 * All configurations remain Auth-Proxy-backed; the panel only overrides
 * presentation (theme, which auth methods are shown, etc.).
 */
export function TurnkeyConfigProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [config, setConfig] = useState<TurnkeyProviderConfig>(defaultConfig)
  // Config Panel open state. Opened from the toggle on the login card and not
  // persisted: the panel only affects login/signup, and its overrides reset on
  // reload anyway.
  const [configPanelOpen, setConfigPanelOpen] = useState(false)

  const value = useMemo<TurnkeyConfigContextType>(
    () => ({
      config,
      setConfig: (updater) => setConfig((prev) => updater(prev)),
      configPanelOpen,
      setConfigPanelOpen,
    }),
    [config, configPanelOpen, setConfigPanelOpen]
  )

  return (
    <TurnkeyConfigContext.Provider value={value}>
      <TurnkeyProvider
        config={config}
        callbacks={{
          // Mark new sub-orgs (SIGNUP only) so ProvisionOnSignup runs; LOGIN
          // never marks, so existing sub-orgs aren't auto-migrated.
          onAuthenticationSuccess: ({ action }) => {
            setConfigPanelOpen(false) // close the Config Panel after auth
            if (typeof window === "undefined") return
            if (String(action) === "SIGNUP") {
              sessionStorage.setItem(PROVISION_MARKER, "1")
            }
          },
          onSessionExpired: () => {
            // The SDK auto-refreshes sessions (auth.autoRefreshSession). If a
            // session still fully expires, send the user back to the landing
            // page to re-authenticate.
            if (typeof window !== "undefined") {
              // Hard reload (not router.push) to clear in-memory session state.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/"
            }
          },
        }}
      >
        {/* Shift the page content left by the panel width when the Config
            Panel is open (sm+) so the non-modal sheet reflows the view instead
            of covering it. Matches SheetContent's sm:w-[380px]. On small
            screens the panel overlays (padding there would leave no room). */}
        <div
          className={cn(
            "transition-[padding] duration-300 ease-in-out",
            configPanelOpen && "sm:pr-[380px]"
          )}
        >
          {children}
        </div>
        {/* Mounted INSIDE TurnkeyProvider so the panel can call useTurnkey()
            (to read the resolved auth methods). The sheet is a controlled
            component whose open state is `configPanelOpen` (so it animates
            open/closed), and it's fixed-position, so its DOM location here
            doesn't affect layout. */}
        <ConfigPanel />
      </TurnkeyProvider>
    </TurnkeyConfigContext.Provider>
  )
}
