"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  TurnkeyProvider,
  TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit"
import { useLocalStorage } from "usehooks-ts"

import { turnkeyConfig as defaultConfig } from "@/config/turnkey"
import { cn } from "@/lib/utils"
import { DevTools } from "@/components/dev-config-panel"
import { PROVISION_MARKER } from "@/components/provision-on-signup"

type TurnkeyConfigContextType = {
  config: TurnkeyProviderConfig
  setConfig: (
    updater: (prev: TurnkeyProviderConfig) => TurnkeyProviderConfig
  ) => void
  devMode: boolean
  setDevMode: (value: boolean) => void
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
 * live by the Developer Mode panel. Mutating the config re-initializes the
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
  // `initializeWithValue: false` returns the default on the first render (server
  // and client alike) and reads the stored value in an effect afterwards. This
  // keeps the initial client render identical to the SSR output, avoiding a
  // hydration mismatch on the conditionally-rendered <DevTools />.
  const [devMode, setDevMode] = useLocalStorage("tk-dev-mode", false, {
    initializeWithValue: false,
  })

  // Allow enabling Developer Mode via a `?dev` query param (persisted after).
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.has("dev")) setDevMode(true)
  }, [setDevMode])

  const value = useMemo<TurnkeyConfigContextType>(
    () => ({
      config,
      setConfig: (updater) => setConfig((prev) => updater(prev)),
      devMode,
      setDevMode,
    }),
    [config, devMode, setDevMode]
  )

  return (
    <TurnkeyConfigContext.Provider value={value}>
      <TurnkeyProvider
        config={config}
        callbacks={{
          // Fires on every successful auth with action SIGNUP | LOGIN,
          // uniformly across passkey / email / OAuth / wallet. We mark new
          // sub-orgs (SIGNUP only) so ProvisionOnSignup applies policies + the
          // Policy Manager + 2/2 on the dashboard. This is the coverage for the
          // OAuth and wallet paths (which have no pre-flight existence check);
          // it's redundant-but-safe with verify-email's explicit marker for the
          // email/passkey paths, and idempotent downstream. LOGIN never marks,
          // so existing sub-orgs (e.g. the sales team's) are never auto-migrated
          // — they migrate deliberately via Settings → Admin.
          onAuthenticationSuccess: ({ action }) => {
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
            devMode && "sm:pr-[380px]"
          )}
        >
          {children}
        </div>
        {/* Mounted INSIDE TurnkeyProvider so panel actions can call useTurnkey()
            (e.g. the Co-signing setup). The sheet is a controlled component
            whose open state is `devMode` (so it animates open/closed), and it's
            fixed-position, so its DOM location here doesn't affect layout. */}
        <DevTools />
      </TurnkeyProvider>
    </TurnkeyConfigContext.Provider>
  )
}
