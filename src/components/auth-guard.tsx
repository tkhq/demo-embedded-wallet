"use client"

import { ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTurnkey } from "@turnkey/react-wallet-kit"

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { authState } = useTurnkey()

  useEffect(() => {
    if (authState === "unauthenticated") {
      router.replace("/")
    }
  }, [authState, router])

  if (authState === "unauthenticated") {
    return null
  }

  return <>{children}</>
}

export function InverseAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { authState } = useTurnkey()

  useEffect(() => {
    if (authState === "authenticated") {
      router.replace("/dashboard")
    }
  }, [authState, router])

  if (authState === "authenticated") {
    return null
  }

  return <>{children}</>
}
