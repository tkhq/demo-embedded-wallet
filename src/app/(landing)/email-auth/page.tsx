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
  const { indexedDbClient } = useTurnkey()
  const rawEmail = searchParams.get("userEmail")
  const userEmail = rawEmail?.includes(" ")
    ? rawEmail.replace(/ /g, "+")
    : rawEmail
  const continueWith = searchParams.get("continueWith")
  const credentialBundle = searchParams.get("credentialBundle")

  useEffect(() => {
    if (userEmail && continueWith && credentialBundle && indexedDbClient) {
      completeEmailAuth({
        userEmail,
        continueWith,
        credentialBundle,
      })
    }
  }, [userEmail, continueWith, credentialBundle, indexedDbClient])

  return (
    <main className="flex w-full flex-col items-center justify-center">
      <Card className="mx-auto h-full w-full sm:w-1/2">
        <CardHeader className="space-y-4">
          <Icons.turnkey className="h-12 w-full stroke-0 py-2 sm:h-14 dark:stroke-white" />
          <CardTitle className="flex items-center justify-center text-center">
            {credentialBundle ? (
              <div className="flex items-center gap-2">
                <Loader className="text-muted-foreground h-4 w-4 animate-spin" />
                <span className="text-base">Authenticating...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-lg font-medium">
                Confirm your email
              </div>
            )}
          </CardTitle>
          {!credentialBundle && (
            <CardDescription className="text-center">
              Click the link sent to{" "}
              <span className="font-bold">{userEmail}</span> to sign in.
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
