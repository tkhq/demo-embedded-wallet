"use client"

import { useCallback, useEffect, useState } from "react"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import {
  provisionNewSubOrg,
  readQuorum,
  setThreshold,
  type RootQuorum,
} from "@/lib/root-quorum"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/button.loader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AwaitingCoSignature } from "@/components/awaiting-cosignature"
import { PendingApprovals } from "@/components/pending-approvals"

// A sensitive action that requires an explicit warning + confirmation before it
// runs (this is what replaces the dev-gate — anyone authenticated can act, but
// only after acknowledging the consequence).
type PendingAction = {
  title: string
  description: string
  warning: string
  confirmLabel: string
  run: () => Promise<void>
}

/**
 * Admin section (Settings). Lets an authenticated user manage their sub-org's
 * root quorum: attach the business Policy Manager key (migrating an existing
 * sub-org) and flip the quorum between 1-of-2 and 2-of-2. Not dev-gated — each
 * sensitive action is behind a warning dialog explaining the control impact.
 */
export function AdminPanel() {
  const { httpClient, session, user } = useTurnkey()
  const [quorum, setQuorum] = useState<RootQuorum | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [running, setRunning] = useState(false)

  const organizationId = session?.organizationId
  const userId = user?.userId

  // Reused for post-action reloads (called from an event handler, not an
  // effect, so setState here is fine).
  const refresh = useCallback(async () => {
    if (!httpClient || !organizationId) return
    try {
      setQuorum(await readQuorum(httpClient, organizationId))
    } catch (err) {
      console.error("Read root quorum failed:", err)
      toast.error(
        err instanceof Error ? err.message : "Failed to read root quorum."
      )
    } finally {
      setLoading(false)
    }
  }, [httpClient, organizationId])

  // Initial load. Inline async IIFE so the setState lands after `await` (not
  // synchronously in the effect body).
  useEffect(() => {
    if (!httpClient || !organizationId) return
    let cancelled = false
    ;(async () => {
      try {
        const q = await readQuorum(httpClient, organizationId)
        if (!cancelled) setQuorum(q)
      } catch (err) {
        console.error("Read root quorum failed:", err)
        toast.error(
          err instanceof Error ? err.message : "Failed to read root quorum."
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [httpClient, organizationId])

  const confirmPending = async () => {
    if (!pending) return
    setRunning(true)
    try {
      await pending.run()
      await refresh()
      setPending(null)
    } catch (err) {
      console.error("Admin action failed:", err)
      toast.error(err instanceof Error ? err.message : "Action failed.")
    } finally {
      setRunning(false)
    }
  }

  // Settings is behind auth already; this is a belt-and-suspenders guard.
  if (!session || !httpClient || !organizationId) return null

  const memberCount = quorum?.userIds.length ?? 0
  const threshold = quorum?.threshold ?? 0
  const hasPolicyManager = memberCount > 1

  // Full migration for an existing (typically 1/1, no-policies) sub-org: apply
  // the policy set scoped to THIS user, attach the Policy Manager, then bump to
  // 2/2 — all unilateral because it runs while the user is still sole root
  // (never-brick order; provisionNewSubOrg is idempotent, so a partial run
  // resumes cleanly on a retry).
  const migrate: PendingAction = {
    title: "Enable co-signing (2 of 2)?",
    description:
      "Applies your wallet's policies, attaches the business's Policy Manager key as a second root user, and raises the quorum to 2 of 2.",
    warning:
      "The Policy Manager becomes a co-owner of your wallet's root quorum: afterward, root-level changes (policies, the quorum) require its approval, and your wallet's policies are enforced. You can still export your keys unilaterally at any time.",
    confirmLabel: "Enable co-signing",
    run: async () => {
      if (!userId) {
        throw new Error("Your user isn't loaded yet — try again in a moment.")
      }
      await provisionNewSubOrg(httpClient, organizationId, userId)
      toast.success("Co-signing enabled — wallet secured at 2 of 2.")
    },
  }

  const bump: PendingAction = {
    title: "Require both signatures (2 of 2)?",
    description:
      "Raises the root quorum so both you and the Policy Manager must approve root actions.",
    warning:
      "This is what makes your wallet's policies actually enforce. Afterward, changing policies or lowering the quorum will require the Policy Manager to co-sign.",
    confirmLabel: "Require 2 of 2",
    run: async () => {
      await setThreshold(httpClient, organizationId, 2)
      toast.success("Root quorum set to 2 of 2.")
    },
  }

  const drop: PendingAction = {
    title: "Reduce to a single signer (1 of 2)?",
    description:
      "Lowers the root quorum so either root user can act on their own.",
    warning:
      "Lowering from 2-of-2 requires the Policy Manager to co-approve, so this stays pending until it does. While at 1-of-2, either root user — including the Policy Manager — can act unilaterally.",
    confirmLabel: "Request 1 of 2",
    run: async () => {
      try {
        await setThreshold(httpClient, organizationId, 1)
        toast.success("Root quorum reduced to 1 of 2.")
      } catch (err) {
        // At 2/2, the downgrade needs the Policy Manager to co-approve, so it
        // lands as a consensus-needed request rather than completing
        // immediately. Treat that as a successful pending request, not a failure.
        const msg = err instanceof Error ? `${err.name} ${err.message}` : ""
        if (/consensus/i.test(msg)) {
          toast.message(
            "Downgrade requested — awaiting Policy Manager approval."
          )
          return
        }
        throw err
      }
    },
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold sm:text-2xl">
            Admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 font-semibold sm:text-lg">Root quorum</h3>
            <Card className="bg-card flex items-center gap-2 rounded-md p-3 sm:justify-between sm:gap-0">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="text-muted-foreground h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:block">Current threshold</span>
              </div>
              <span className="text-muted-foreground text-xs sm:text-base">
                {loading || !quorum
                  ? "Loading…"
                  : `${threshold} of ${memberCount}` +
                    (hasPolicyManager ? "" : " (no Policy Manager)")}
              </span>
            </Card>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {!loading && !hasPolicyManager && (
              <Button
                className="w-full sm:w-auto"
                onClick={() => setPending(migrate)}
              >
                Enable co-signing
              </Button>
            )}
            {!loading && hasPolicyManager && threshold === 1 && (
              <Button
                className="w-full sm:w-auto"
                onClick={() => setPending(bump)}
              >
                Require 2 of 2
              </Button>
            )}
            {!loading && hasPolicyManager && threshold >= 2 && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setPending(drop)}
              >
                Reduce to 1 of 2
              </Button>
            )}
          </div>

          <PendingApprovals onChange={refresh} />

          <AwaitingCoSignature />
        </CardContent>
      </Card>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !running) setPending(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.title}</DialogTitle>
            <DialogDescription>{pending?.description}</DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{pending?.warning}</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={running}
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <LoadingButton loading={running} onClick={confirmPending}>
              {pending?.confirmLabel}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
