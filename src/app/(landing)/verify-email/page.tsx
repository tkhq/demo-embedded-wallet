"use client"

import { Suspense, useCallback, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { OtpType, useTurnkey } from "@turnkey/react-wallet-kit"
import { REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
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
  const { verifyOtp, completeOtp, signUpWithOtp, createPasskey, config } =
    useTurnkey()

  // OTP length + alphabet come from org config (SDK-resolved from the Auth Proxy).
  const otpLength = Number(config?.auth?.otpLength) || 6
  const otpAlphanumeric = config?.auth?.otpAlphanumeric ?? true
  const otpPattern = otpAlphanumeric
    ? REGEXP_ONLY_DIGITS_AND_CHARS
    : REGEXP_ONLY_DIGITS

  const otpId = searchParams.get("id") || ""
  const email = searchParams.get("email") || ""
  const type = (searchParams.get("type") || "").toLowerCase()
  // Passkey reaches this page only on signup (always a new sub-org).
  const isNewAccount = type === "passkey"

  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isComplete = useMemo(() => code.length === otpLength, [code, otpLength])

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

        const passkeyName = "Default Passkey"
        const passkey = await createPasskey({ name: passkeyName })
        if (!passkey) {
          toast.error("Passkey creation failed. Try again.")
          return
        }

        // Passkey signup goes through signUpWithOtp with the passkey attached
        // as an authenticator, so the email's OTP verification token is honored.
        await signUpWithOtp({
          verificationToken,
          contact: email,
          otpType: OtpType.Email,
          createSubOrgParams: {
            userName: "Passkey User",
            customWallet,
            authenticators: [
              {
                authenticatorName: passkeyName,
                challenge: passkey.encodedChallenge,
                attestation: passkey.attestation,
              },
            ],
          },
        })
        sessionStorage.removeItem(`otp-bundle:${otpId}`)
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
    completeOtp,
    signUpWithOtp,
    createPasskey,
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
            Enter the {otpLength}-character code sent to{" "}
            <span className="font-semibold">{email}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={otpLength}
              pattern={otpPattern}
              value={code}
              onChange={setCode}
            >
              <InputOTPGroup>
                {Array.from({ length: otpLength }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <LoadingButton
            className="w-full font-semibold"
            disabled={!isComplete || submitting}
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
