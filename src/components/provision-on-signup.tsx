"use client"

import { useEffect, useRef } from "react"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import { provisionNewSubOrg, subOrgIsFresh } from "@/lib/root-quorum"

// sessionStorage marker set by the signup paths (verify-email) so this only
// fires for brand-new sub-orgs — existing sub-orgs migrate deliberately via the
// Admin panel, never silently here.
export const PROVISION_MARKER = "tk:provision-new"

// A fresh signup provisions within the same session (seconds–minutes), while an
// established account is far older, so this window sits comfortably between the
// two — its exact value isn't sensitive. Belt-and-suspenders with the marker:
// we only auto-provision a sub-org that was actually just created.
const FRESH_SUBORG_WINDOW_MS = 15 * 60 * 1000

/**
 * Renders nothing. On the first authenticated load after a signup (marker set),
 * provisions the new sub-org on the live session: apply policies + ABIs, add
 * the Policy Manager, then bump to 2/2 — in that order so it never bricks.
 * provisionNewSubOrg is idempotent, and the marker is cleared before running so
 * it won't loop; a rare failure is recoverable via Settings → Admin.
 */
export function ProvisionOnSignup() {
  const { httpClient, session, user } = useTurnkey()
  const ran = useRef(false)
  const organizationId = session?.organizationId
  const userId = user?.userId

  useEffect(() => {
    // Wait for userId too: the self-service wallet policy is scoped to it, so
    // provisioning before it's known would create the policy set without that
    // (user-only create/import/export) rule.
    if (ran.current || !httpClient || !organizationId || !userId) return
    if (typeof window === "undefined") return
    if (sessionStorage.getItem(PROVISION_MARKER) !== "1") return

    ran.current = true
    sessionStorage.removeItem(PROVISION_MARKER)

    let cancelled = false
    ;(async () => {
      try {
        // Only auto-provision a sub-org that was actually just created at
        // signup. An existing account is migrated deliberately from the Admin
        // panel, never silently on sign-in.
        if (
          !(await subOrgIsFresh(
            httpClient,
            organizationId,
            FRESH_SUBORG_WINDOW_MS
          ))
        ) {
          return
        }
        await provisionNewSubOrg(httpClient, organizationId, userId)
        if (!cancelled) {
          toast.success("Wallet secured with 2-of-2 co-signing.")
        }
      } catch (err) {
        console.error("New-sub-org provisioning failed:", err)
        if (!cancelled) {
          toast.error(
            "Couldn't finish securing your wallet — you can complete it in Settings → Admin."
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [httpClient, organizationId, userId])

  return null
}
