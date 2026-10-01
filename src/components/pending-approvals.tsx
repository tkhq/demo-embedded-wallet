"use client"

import { useCallback, useEffect, useState } from "react"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import {
  approvePendingActivity,
  listPendingApprovals,
  rejectPendingActivity,
  type PendingActivity,
} from "@/lib/root-quorum"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/button.loader"
import { Card } from "@/components/ui/card"

// Turn "ACTIVITY_TYPE_UPDATE_ROOT_QUORUM" into "Update root quorum".
export function activityLabel(type: string): string {
  const base = type
    .replace(/^ACTIVITY_TYPE_/, "")
    .replace(/_V\d+$/, "")
    .replaceAll("_", " ")
    .toLowerCase()
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/**
 * Lists changes the Policy Manager has submitted that await this user's
 * co-signature (2/2), and lets the user approve or reject each. `onChange`
 * fires after a successful action so the parent can refresh (e.g. the quorum
 * display, if an approved change altered it).
 */
export function PendingApprovals({ onChange }: { onChange?: () => void }) {
  const { httpClient, session, user } = useTurnkey()
  const organizationId = session?.organizationId
  const userId = user?.userId
  const [items, setItems] = useState<PendingActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<{
    fingerprint: string
    kind: "approve" | "reject"
  } | null>(null)

  // Reused after an action (called from a handler, so setState is fine here).
  const load = useCallback(async () => {
    if (!httpClient || !organizationId || !userId) return
    try {
      setItems(await listPendingApprovals(httpClient, organizationId, userId))
    } catch (err) {
      console.error("Load pending approvals failed:", err)
      toast.error(
        err instanceof Error ? err.message : "Failed to load pending approvals."
      )
    } finally {
      setLoading(false)
    }
  }, [httpClient, organizationId, userId])

  // Initial load via inline IIFE so the setState lands after `await`.
  useEffect(() => {
    if (!httpClient || !organizationId || !userId) return
    let cancelled = false
    ;(async () => {
      try {
        const pending = await listPendingApprovals(
          httpClient,
          organizationId,
          userId
        )
        if (!cancelled) setItems(pending)
      } catch (err) {
        console.error("Load pending approvals failed:", err)
        if (!cancelled) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to load pending approvals."
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [httpClient, organizationId, userId])

  const act = async (fingerprint: string, kind: "approve" | "reject") => {
    if (!httpClient || !organizationId) return
    setBusy({ fingerprint, kind })
    try {
      if (kind === "approve") {
        await approvePendingActivity(httpClient, organizationId, fingerprint)
        toast.success("Change approved.")
      } else {
        await rejectPendingActivity(httpClient, organizationId, fingerprint)
        toast.success("Change rejected.")
      }
      await load()
      onChange?.()
    } catch (err) {
      console.error(`${kind} activity failed:`, err)
      toast.error(err instanceof Error ? err.message : `Failed to ${kind}.`)
    } finally {
      setBusy(null)
    }
  }

  if (!session || !httpClient) return null

  return (
    <div>
      <h3 className="mb-2 font-semibold sm:text-lg">Pending approvals</h3>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No changes awaiting your approval.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card
              key={item.fingerprint}
              className="bg-card flex flex-col gap-3 rounded-md p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium">{activityLabel(item.type)}</div>
                <div className="text-muted-foreground text-xs">
                  Requested {item.createdAt.toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <LoadingButton
                  variant="outline"
                  size="sm"
                  loading={
                    busy?.fingerprint === item.fingerprint &&
                    busy.kind === "reject"
                  }
                  disabled={busy !== null}
                  onClick={() => act(item.fingerprint, "reject")}
                >
                  Reject
                </LoadingButton>
                <LoadingButton
                  size="sm"
                  loading={
                    busy?.fingerprint === item.fingerprint &&
                    busy.kind === "approve"
                  }
                  disabled={busy !== null}
                  onClick={() => act(item.fingerprint, "approve")}
                >
                  Approve
                </LoadingButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
