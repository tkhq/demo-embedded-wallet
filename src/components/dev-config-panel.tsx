"use client"

import { useTurnkeyConfig } from "@/providers/config/config-provider"
import { TurnkeyProviderConfig } from "@turnkey/react-wallet-kit"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type AuthMethods = NonNullable<
  NonNullable<NonNullable<TurnkeyProviderConfig["ui"]>["authModal"]>["methods"]
>

const METHOD_OPTIONS: { key: keyof AuthMethods; label: string }[] = [
  { key: "emailOtpAuthEnabled", label: "Email OTP" },
  { key: "passkeyAuthEnabled", label: "Passkey" },
  { key: "walletAuthEnabled", label: "External wallet" },
  { key: "googleOauthEnabled", label: "Google" },
  { key: "appleOauthEnabled", label: "Apple" },
  { key: "facebookOauthEnabled", label: "Facebook" },
]

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Label className="text-sm">{label}</Label>
      <Button
        type="button"
        size="sm"
        variant={checked ? "default" : "outline"}
        className="w-16"
        onClick={() => onChange(!checked)}
      >
        {checked ? "On" : "Off"}
      </Button>
    </div>
  )
}

/**
 * Config Panel. Its open/closed state IS `devMode`: the sheet is open exactly
 * when `devMode` is true, and closing it (via the landing-page toggle, the X,
 * or Escape) sets `devMode` false.
 * Lets you mutate the live TurnkeyProviderConfig — toggling which auth methods
 * appear in the login modal — without affecting the normal user experience. All
 * changes are presentation overrides on top of the Auth-Proxy-backed config.
 */
export function DevTools() {
  const { config, setConfig, devMode, setDevMode } = useTurnkeyConfig()

  const methods = config.ui?.authModal?.methods ?? {}

  const setMethod = (key: keyof AuthMethods, value: boolean) => {
    setConfig((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        authModal: {
          ...prev.ui?.authModal,
          methods: {
            ...prev.ui?.authModal?.methods,
            [key]: value,
          },
        },
      },
    }))
  }

  return (
    <Sheet open={devMode} onOpenChange={setDevMode} modal={false}>
      <SheetContent
        showOverlay={false}
        className="w-[340px] overflow-y-auto sm:w-[380px]"
        // Non-modal: keep the rest of the page interactive so config changes can
        // be demoed live. Don't let clicks or focus moves on the page close the
        // panel — only the toggle, the X, or Escape do.
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Config Panel</SheetTitle>
          <SheetDescription>
            Live-edit the Wallet Kit configuration. Changes apply immediately
            and re-initialize the Turnkey client. Auth methods override the
            dashboard defaults.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
              Auth methods
            </h3>
            {METHOD_OPTIONS.map(({ key, label }) => (
              <Toggle
                key={key}
                label={label}
                checked={methods[key] ?? true}
                onChange={(value) => setMethod(key, value)}
              />
            ))}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
