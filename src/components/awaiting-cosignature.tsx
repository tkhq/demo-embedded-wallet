"use client"

import { useEffect, useState } from "react"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { listAwaitingCoSignature, type PendingActivity } from "@/lib/root-quorum"
import { Card } from "@/components/ui/card"
import { activityLabel } from "@/components/pending-approvals"

/**
 * Read-only list of the current user's OWN actions that are pending the Policy
 * Manager's co-signature (2/2). This is the user side of the consensus story:
 * when a transfer isn't covered by the wallet's policy it escalates to here —
 * awaiting a second approval — rather than being rejected outright. The Policy
 * Manager completes (or declines) these from the admin script.
 */
export function AwaitingCoSignature() {
  const { httpClient, session, user } = useTurnkey()
  const organizationId = session?.organizationId
  const userId = user?.userId
  const [items, setItems] = useState<PendingActivity[]>([])
  const [loading, setLoading] = useState(true)

  // Inline async IIFE so the setState lands after `await` (not synchronously in
  // the effect body).
  useEffect(() => {
    if (!httpClient || !organizationId || !userId) return
    let cancelled = false
    ;(async () => {
      try {
        const pending = await listAwaitingCoSignature(
          httpClient,
          organizationId,
          userId
        )
        if (!cancelled) setItems(pending)
      } catch (err) {
        console.error("Load awaiting co-signature failed:", err)
        if (!cancelled) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to load pending transfers."
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

  if (!session || !httpClient) return null

  return (
    <div>
      <h3 className="mb-2 font-semibold sm:text-lg">Awaiting co-signature</h3>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing awaiting co-signature.
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
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  item.expired
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                )}
              >
                {item.expired ? "Expired" : "Pending co-signature"}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
