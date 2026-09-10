"use client"

import { ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit"

// Protects authenticated routes: send unauthenticated users to the landing page.
export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { authState } = useTurnkey()

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) {
      router.replace("/")
    }
  }, [authState, router])

  if (authState === AuthState.Unauthenticated) {
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
