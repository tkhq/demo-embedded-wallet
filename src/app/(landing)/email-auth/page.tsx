"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useTurnkey } from "@turnkey/sdk-react"
import { Loader, Send } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Icons } from "@/components/icons"

function EmailAuthContent() {
  const searchParams = useSearchParams()
  const { completeEmailAuth } = useAuth()
  const { authIframeClient } = useTurnkey()
  const userEmail = searchParams.get("userEmail")
  const continueWith = searchParams.get("continueWith")
  const credentialBundle = searchParams.get("credentialBundle")

  useEffect(() => {
    // Ensure that the authIframeClient is available before attempting to complete the email auth
    if (authIframeClient && userEmail && continueWith && credentialBundle) {
      completeEmailAuth({ userEmail, continueWith, credentialBundle })
    }
  }, [authIframeClient])

  return (
    <main className="flex w-full flex-col items-center justify-center">
      <Card className="mx-auto h-full w-full sm:w-1/2">
        <CardHeader className="space-y-4">
          <Icons.turnkey className="h-12 w-full stroke-0 py-2 dark:stroke-white sm:h-14" />
          <CardTitle className="flex  items-center justify-center text-center">
            {credentialBundle ? (
              <div className="flex items-center gap-2">
                <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-base">Authenticating...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-lg font-medium">
                Magic link sent <Send className="h-5 w-5" />
              </div>
            )}
          </CardTitle>
          {!credentialBundle && (
            <CardDescription className="text-center">
              A confirmation link has been sent to your email. Click the link to
              sign in.
            </CardDescription>
          )}
        </CardHeader>
      </Card>
    </main>
  )
}

export default function EmailAuth() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EmailAuthContent />
    </Suspense>
  )
}
