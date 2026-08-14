"use client"

import { useEffect } from "react"

import { isSendRejectedError, isUserCancelError } from "@/lib/utils"

/**
 * Renders nothing. On the send-error and modal-cancel paths a benign promise
 * rejection can arrive separately from the awaited call the transfer flow
 * already catches — e.g. a send that needs a co-signature ("Missing
 * sendTransactionStatusId") or a dismissed modal. Left unhandled it would
 * surface as an app-wide `unhandledrejection`. This listener suppresses only
 * those known-benign rejections (logging them) and lets everything else
 * propagate normally.
 */
export function RwkRejectionGuard() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      if (isUserCancelError(reason) || isSendRejectedError(reason)) {
        console.warn("Suppressed benign promise rejection:", reason)
        event.preventDefault()
      }
    }
    window.addEventListener("unhandledrejection", onRejection)
    return () => window.removeEventListener("unhandledrejection", onRejection)
  }, [])

  return null
}
