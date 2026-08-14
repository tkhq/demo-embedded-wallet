"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTurnkeyConfig } from "@/providers/config/config-provider"
import { zodResolver } from "@hookform/resolvers/zod"
import { OtpType, useTurnkey } from "@turnkey/react-wallet-kit"
import { Settings2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { Email } from "@/types/turnkey"
import { customWallet } from "@/config/turnkey"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/button.loader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import OrSeparator from "@/components/or-separator"

import AppleAuth from "./apple-auth"
import FacebookAuth from "./facebook-auth"
import GoogleAuth from "./google-auth"
import { Icons } from "./icons"
import Legal from "./legal"

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
})

function AuthContent() {
  const {
    httpClient,
    initOtp,
    loginWithPasskey,
    loginOrSignupWithWallet,
    walletProviders,
  } = useTurnkey()
  const { config, devMode, setDevMode } = useTurnkeyConfig()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [walletDialogOpen, setWalletDialogOpen] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })

  useEffect(() => {
    const qsError = searchParams.get("error")
    if (qsError) {
      toast.error(qsError)
    }
  }, [searchParams])

  const handlePasskeyLogin = async (email: Email) => {
    setLoadingAction("passkey")
    // Check to see if the user's account exists
    const account = await httpClient?.proxyGetAccount({
      filterType: "EMAIL",
      filterValue: email,
    })

    // If the user's account exists, we assume they have already created a passkey
    if (account?.organizationId) {
      await loginWithPasskey()
    } else {
      // If the user's account does not exist, we assume they have not created a passkey
      // and we need to verify their email via OTP and then sign them up
      const { otpId, otpEncryptionTargetBundle } = await initOtp({
        otpType: OtpType.Email,
        contact: email,
      })

      if (otpId) {
        // The encryption target bundle is required by verifyOtp/completeOtp on the
        // verification page; stash it keyed by otpId for the next step.
        sessionStorage.setItem(`otp-bundle:${otpId}`, otpEncryptionTargetBundle)
        router.push(
          `/verify-email?id=${encodeURIComponent(otpId)}&email=${encodeURIComponent(
            email
          )}&type=passkey`
        )
      }
    }

    setLoadingAction(null)
  }

  const handleEmailLogin = async (email: Email) => {
    setLoadingAction("email")
    try {
      // Email OTP is login-or-signup. Check existence up front (same as the
      // passkey path) so the verify step knows whether it's a NEW sub-org and
      // should trigger provisioning (policies + Policy Manager + 2/2).
      const account = await httpClient?.proxyGetAccount({
        filterType: "EMAIL",
        filterValue: email,
      })
      const isNew = !account?.organizationId

      const { otpId, otpEncryptionTargetBundle } = await initOtp({
        otpType: OtpType.Email,
        contact: email,
      })

      if (otpId) {
        sessionStorage.setItem(`otp-bundle:${otpId}`, otpEncryptionTargetBundle)
        router.push(
          `/verify-email?id=${encodeURIComponent(otpId)}&email=${encodeURIComponent(
            email
          )}&type=email&new=${isNew ? "1" : "0"}`
        )
      }
    } finally {
      setLoadingAction(null)
    }
  }

  const openWalletDialog = () => {
    setWalletDialogOpen(true)
  }

  const filteredWalletProviders = walletProviders.filter(
    (p) => p.interfaceType !== "solana"
  )

  const handleWalletLogin = async (provider: any) => {
    setLoadingAction("wallet")
    try {
      await loginOrSignupWithWallet({
        walletProvider: provider,
        createSubOrgParams: {
          customWallet,
        },
      })
    } finally {
      setLoadingAction(null)
      setWalletDialogOpen(false)
    }
  }

  // Which auth methods to surface on this custom login card. Mirrors the RWK
  // auth modal: when a method is unset in the config it defaults to enabled, so
  // with Dev Mode off every button shows (unchanged behavior). The Dev Mode
  // panel writes explicit overrides into ui.authModal.methods, which then hide
  // or show the matching buttons here.
  const methods = config.ui?.authModal?.methods ?? {}
  const isEnabled = (key: keyof NonNullable<typeof methods>) =>
    methods[key] ?? true

  const passkeyEnabled = isEnabled("passkeyAuthEnabled")
  const emailEnabled = isEnabled("emailOtpAuthEnabled")
  const walletEnabled = isEnabled("walletAuthEnabled")
  const googleEnabled = isEnabled("googleOauthEnabled")
  const appleEnabled = isEnabled("appleOauthEnabled")
  const facebookEnabled = isEnabled("facebookOauthEnabled")

  const showEmailInput = passkeyEnabled || emailEnabled
  const showWalletSeparator = showEmailInput && walletEnabled
  const showOauthSeparator =
    (passkeyEnabled || emailEnabled || walletEnabled) &&
    (googleEnabled || appleEnabled || facebookEnabled)

  return (
    <>
      <Card className="mx-auto w-full max-w-[450px]">
        <CardHeader className="space-y-4">
          <div className="relative flex items-center justify-center gap-2">
            <Icons.turnkey className="h-16 w-full stroke-0 py-2" />
            <Badge
              variant="secondary"
              className="border-primary bg-primary/0 text-primary absolute -right-1 px-1 py-0.5 text-xs sm:top-4 sm:right-9"
            >
              Demo
            </Badge>
          </div>
          <CardTitle className="text-center text-xl font-medium">
            Log in or sign up
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(() => {})} className="space-y-4">
              {showEmailInput && (
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {passkeyEnabled && (
                <LoadingButton
                  type="submit"
                  className="w-full font-semibold"
                  disabled={!form.formState.isValid}
                  loading={loadingAction === "passkey"}
                  onClick={() =>
                    handlePasskeyLogin(form.getValues().email as Email)
                  }
                >
                  Continue with passkey
                </LoadingButton>
              )}

              {emailEnabled && (
                <LoadingButton
                  type="button"
                  variant="outline"
                  className="w-full font-semibold"
                  disabled={!form.formState.isValid}
                  onClick={() =>
                    handleEmailLogin(form.getValues().email as Email)
                  }
                  loading={loadingAction === "email"}
                >
                  Continue with email
                </LoadingButton>
              )}
              {showWalletSeparator && <OrSeparator />}
              {walletEnabled && (
                <LoadingButton
                  type="button"
                  variant="outline"
                  className="w-full font-semibold"
                  onClick={openWalletDialog}
                  loading={loadingAction === "wallet"}
                >
                  Continue with wallet
                </LoadingButton>
              )}
            </form>
          </Form>
          {showOauthSeparator && <OrSeparator />}
          {googleEnabled && <GoogleAuth />}
          {appleEnabled && <AppleAuth />}
          {facebookEnabled && <FacebookAuth />}
        </CardContent>
      </Card>
      <Legal />
      <div className="mt-4 flex items-center justify-center gap-2">
        <span className="text-muted-foreground text-xs">Config Panel</span>
        <Button
          type="button"
          size="sm"
          variant={devMode ? "default" : "outline"}
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={() => setDevMode(!devMode)}
          aria-pressed={devMode}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {devMode ? "On" : "Off"}
        </Button>
      </div>
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Select a wallet</DialogTitle>
            <DialogDescription>
              Choose a wallet provider to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {filteredWalletProviders.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No compatible wallet providers found.
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredWalletProviders.map((p, idx) => (
                  <Button
                    key={`${p?.info?.name ?? "provider"}-${idx}`}
                    type="button"
                    variant="outline"
                    className="justify-start gap-3"
                    onClick={() => handleWalletLogin(p)}
                  >
                    {p?.info?.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.info.icon}
                        alt={`${p.info.name} logo`}
                        className="h-5 w-5"
                      />
                    ) : (
                      <div className="bg-accent flex h-6 w-6 items-center justify-center rounded text-xs font-semibold">
                        {(p?.info?.name?.[0] ?? "W").toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">
                        {p?.info?.name ?? "Wallet"}
                      </span>
                      {Array.isArray(p?.connectedAddresses) &&
                      p.connectedAddresses.length > 0 ? (
                        <span className="text-muted-foreground text-xs">
                          {p.connectedAddresses.length} connected
                        </span>
                      ) : null}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function Auth() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthContent />
    </Suspense>
  )
}
