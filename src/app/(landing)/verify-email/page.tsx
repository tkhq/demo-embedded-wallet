"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { toast } from "sonner"

import { LoadingButton } from "@/components/ui/button.loader"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { InverseAuthGuard } from "@/components/auth-guard"
import { Icons } from "@/components/icons"

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { httpClient, signUpWithPasskey } = useTurnkey()

  const otpId = searchParams.get("id") || ""
  const email = searchParams.get("email") || ""

  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isSixDigits = useMemo(() => code.length === 6, [code])

  const handleVerify = useCallback(async () => {
    if (!otpId || !email) {
      toast.error("Missing verification context. Please restart sign in.")
      router.replace("/")
      return
    }

    try {
      setSubmitting(true)
      const res = await httpClient?.proxyVerifyOtp({ otpId, otpCode: code })
      if (!res?.verificationToken) {
        toast.error("Verification failed. Try again.")
        return
      }

      // Proceed to passkey signup post verification
      await signUpWithPasskey({
        createSubOrgParams: {
          verificationToken: res.verificationToken,
          userEmail: email,
        },
      })

      // Route to dashboard; AuthGuard will also handle redirects
      router.replace("/dashboard")
    } catch (err: any) {
      const message: string = err?.message || "Verification error"
      if (message.toLowerCase().includes("invalid otp")) {
        toast.error("Invalid code. Please try again.")
      } else {
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
  }, [otpId, email, code, httpClient, signUpWithPasskey, router])

  return (
    <main className="flex w-full flex-col items-center justify-center">
      <Card className="mx-auto w-full max-w-[450px]">
        <CardHeader className="space-y-4">
          <Icons.turnkey className="h-16 w-full stroke-0 py-2" />
          <CardTitle className="text-center text-xl font-medium">
            Please verify your email
          </CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code sent to{" "}
            <span className="font-semibold">{email}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <LoadingButton
            className="w-full font-semibold"
            disabled={!isSixDigits || submitting}
            loading={submitting}
            onClick={handleVerify}
          >
            Verify and continue
          </LoadingButton>
        </CardContent>
      </Card>
    </main>
  )
}
