"use client"

import { ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AuthState, ClientState, useTurnkey } from "@turnkey/react-wallet-kit"

// Protects authenticated routes: send unauthenticated users to the landing page.
//
// On a page load `authState` starts as "unauthenticated" until the client has
// restored the stored session, so only decide once the client is ready (or
// failed to initialize). `authState` is derived from `session` in an effect and
// can trail it by a render, so a live session also counts as signed in.
export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { authState, clientState, session } = useTurnkey()

  const initializing =
    clientState !== ClientState.Ready && clientState !== ClientState.Error

  useEffect(() => {
    if (initializing || authState !== AuthState.Unauthenticated) return
    const hasLiveSession = !!session && session.expiry * 1000 > Date.now()
    if (!hasLiveSession) {
      router.replace("/")
    }
  }, [initializing, authState, session, router])

  if (initializing || authState !== AuthState.Authenticated) {
    return null
  }

  return <>{children}</>
}

// Protects the landing page: send authenticated users to the dashboard.
export function InverseAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { authState } = useTurnkey()

  useEffect(() => {
    if (authState === AuthState.Authenticated) {
      router.replace("/dashboard")
    }
  }, [authState, router])

  if (authState === AuthState.Authenticated) {
    return null
  }

  return <>{children}</>
}
