"use client"

import { Suspense, useCallback, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { OtpType, useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import { customWallet } from "@/config/turnkey"
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
import { Icons } from "@/components/icons"
import { PROVISION_MARKER } from "@/components/provision-on-signup"

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { verifyOtp, signUpWithPasskey, completeOtp } = useTurnkey()

  const otpId = searchParams.get("id") || ""
  const email = searchParams.get("email") || ""
  const type = (searchParams.get("type") || "").toLowerCase()
  // Email OTP is login-or-signup; auth.tsx sets new=1 when the account didn't
  // exist. Passkey reaches this page only on signup, so it's always new.
  const isNewAccount = type === "passkey" || searchParams.get("new") === "1"

  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isSixDigits = useMemo(() => code.length === 6, [code])

  const handleVerify = useCallback(async () => {
    if (!otpId || !email || (type !== "passkey" && type !== "email")) {
      toast.error("Missing verification context. Please restart sign in.")
      router.replace("/")
      return
    }

    // The encryption target bundle produced by initOtp is required to complete
    // the OTP flow in react-wallet-kit v2. It was stashed keyed by otpId.
    const otpEncryptionTargetBundle =
      typeof window !== "undefined"
        ? sessionStorage.getItem(`otp-bundle:${otpId}`) || ""
        : ""

    if (!otpEncryptionTargetBundle) {
      toast.error("Verification session expired. Please restart sign in.")
      router.replace("/")
      return
    }

    try {
      setSubmitting(true)
      if (type === "passkey") {
        const { verificationToken } = await verifyOtp({
          otpId,
          otpCode: code,
          otpEncryptionTargetBundle,
        })
        if (!verificationToken) {
          toast.error("Verification failed. Try again.")
          return
        }

        await signUpWithPasskey({
          createSubOrgParams: {
            customWallet,
            verificationToken,
            userEmail: email,
          },
        })
        sessionStorage.removeItem(`otp-bundle:${otpId}`)
        // New sub-org → let the dashboard provision it (policies + Policy
        // Manager + 2/2). See ProvisionOnSignup.
        if (isNewAccount) sessionStorage.setItem(PROVISION_MARKER, "1")
        router.replace("/dashboard")
      } else if (type === "email") {
        // completeOtp verifies the code and logs in (or signs up) the user
        await completeOtp({
          otpId,
          otpCode: code,
          otpEncryptionTargetBundle,
          contact: email,
          otpType: OtpType.Email,
          createSubOrgParams: {
            customWallet,
            userEmail: email,
          },
        })
        sessionStorage.removeItem(`otp-bundle:${otpId}`)
        if (isNewAccount) sessionStorage.setItem(PROVISION_MARKER, "1")
        router.replace("/dashboard")
      }
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
  }, [
    otpId,
    email,
    code,
    type,
    isNewAccount,
    verifyOtp,
    signUpWithPasskey,
    completeOtp,
    router,
  ])

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
