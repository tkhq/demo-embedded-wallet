"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTurnkey } from "@turnkey/react-wallet-kit"
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
    loginWithPasskey,
    user,
    loginOrSignupWithWallet,
    getWalletProviders,
  } = useTurnkey()
  const { state } = useAuth()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [walletDialogOpen, setWalletDialogOpen] = useState(false)
  const [isLoadingProviders, setIsLoadingProviders] = useState(false)
  const [walletProviders, setWalletProviders] = useState<any[]>([])

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
      const init = await httpClient?.proxyInitOtp({
        otpType: "OTP_TYPE_EMAIL",
        contact: email,
      })

      if (init?.otpId) {
        router.push(
          `/verify-email?id=${encodeURIComponent(init.otpId)}&email=${encodeURIComponent(
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
      const init = await httpClient?.proxyInitOtp({
        otpType: "OTP_TYPE_EMAIL",
        contact: email,
      })

      if (init?.otpId) {
        router.push(
          `/verify-email?id=${encodeURIComponent(init.otpId)}&email=${encodeURIComponent(
            email
          )}&type=email`
        )
      }
    } finally {
      setLoadingAction(null)
    }
  }

  const openWalletDialog = async () => {
    setWalletDialogOpen(true)
    setIsLoadingProviders(true)
    try {
      const providers = await getWalletProviders()

      setWalletProviders(
        providers.filter((p) => p.interfaceType !== "solana") ?? []
      )
    } finally {
      setIsLoadingProviders(false)
    }
  }

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

  // Redirect to dashboard when user session is established
  useEffect(() => {
    if (user) {
      router.push("/dashboard")
    }
  }, [user, router])

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
              <LoadingButton
                type="submit"
                className="w-full font-semibold"
                disabled={!form.formState.isValid}
                loading={state.loading && loadingAction === "passkey"}
                onClick={() =>
                  handlePasskeyLogin(form.getValues().email as Email)
                }
              >
                Continue with passkey
              </LoadingButton>

              <LoadingButton
                type="button"
                variant="outline"
                className="w-full font-semibold"
                disabled={!form.formState.isValid}
                onClick={() =>
                  handleEmailLogin(form.getValues().email as Email)
                }
                loading={state.loading && loadingAction === "email"}
              >
                Continue with email
              </LoadingButton>
              <OrSeparator />
              <LoadingButton
                type="button"
                variant="outline"
                className="w-full font-semibold"
                onClick={openWalletDialog}
                loading={state.loading && loadingAction === "wallet"}
              >
                Continue with wallet
              </LoadingButton>
            </form>
          </Form>
          <OrSeparator />
          <GoogleAuth />
          <AppleAuth />
          <FacebookAuth />
        </CardContent>
      </Card>
      <Legal />
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Select a wallet</DialogTitle>
            <DialogDescription>
              Choose a wallet provider to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {isLoadingProviders ? (
              <div className="text-muted-foreground text-sm">
                Loading providers…
              </div>
            ) : walletProviders.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No compatible wallet providers found.
              </div>
            ) : (
              <div className="grid gap-2">
                {walletProviders.map((p, idx) => (
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
