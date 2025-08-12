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
import { Badge } from "@/components/ui/badge"
import { LoadingButton } from "@/components/ui/button.loader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const { httpClient, loginWithPasskey, signUpWithPasskey, user } = useTurnkey()
  const { initEmailLogin, state, loginWithWallet } = useAuth()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })

  useEffect(() => {
    console.log("user", user)
    if (user) {
      // router.push("/dashboard")
      // if (email) {
      //   console.log("updating user email", user.userId, email)
      //   httpClient?.updateUserEmail({
      //     userId: user.userId,
      //     userEmail: email,
      //   })
      // }
    }
  }, [user, router])

  useEffect(() => {
    const qsError = searchParams.get("error")
    if (qsError) {
      toast.error(qsError)
    }
  }, [searchParams])

  const handlePasskeyLogin = async (email: Email) => {
    setEmail(email)
    setLoadingAction("passkey")
    // Check to see if the user's account exists
    const account = await httpClient?.proxyGetAccount({
      filterType: "EMAIL",
      filterValue: email,
    })
    // TODO: If account is {} or undefined that means this email is not verified and therefore no account exists

    // TODO: First call initOTP to verify the email
    // TODO: Then call signUpWithPasskey to create the account

    console.log("account", account?.organizationId)
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
          `/verify-email?id=${encodeURIComponent(init.otpId)}&email=${encodeURIComponent(email)}`
        )
      }
    }

    setLoadingAction(null)
  }

  const handleEmailLogin = async (email: Email) => {
    setLoadingAction("email")
    await initEmailLogin(email)
    setLoadingAction(null)
  }

  const handleWalletLogin = async () => {
    setLoadingAction("wallet")
    await loginWithWallet()
    setLoadingAction(null)
  }

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
                onClick={() => handleWalletLogin()}
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
