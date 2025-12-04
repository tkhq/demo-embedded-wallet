"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/providers/auth-provider"
import { toast } from "sonner"

const WARNING_BUFFER = 15 // seconds

export function SessionExpiryWarning() {
  const { state } = useAuth()
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const toastIdRef = useRef<string | number | undefined>(undefined)
  const countdownRef = useRef(WARNING_BUFFER)

  useEffect(() => {
    if (state.sessionExpiring) {
      // Reset countdown
      countdownRef.current = WARNING_BUFFER

      // Create initial toast with Infinity duration so it doesn't auto-dismiss
      toastIdRef.current = toast.warning(
        `Session expiring in ${WARNING_BUFFER} secs`,
        {
          duration: Infinity,
        }
      )

      // Update countdown every second
      intervalRef.current = setInterval(() => {
        countdownRef.current -= 1

        if (countdownRef.current <= 0) {
          // Clean up when countdown reaches 0
          if (intervalRef.current) clearInterval(intervalRef.current)
          if (toastIdRef.current) toast.dismiss(toastIdRef.current)
          return
        }

        // Update existing toast with new countdown
        if (toastIdRef.current) {
          toast.warning(`Session expiring in ${countdownRef.current} secs`, {
            id: toastIdRef.current,
            duration: Infinity,
          })
        }
      }, 1000)
    } else {
      // Clean up when sessionExpiring becomes false
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (toastIdRef.current) toast.dismiss(toastIdRef.current)
    }

    // Cleanup on unmount or when sessionExpiring changes
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (toastIdRef.current) toast.dismiss(toastIdRef.current)
    }
  }, [state.sessionExpiring])

  return null
}
