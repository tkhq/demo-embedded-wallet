import { useTurnkey } from "@turnkey/react-wallet-kit"

import { env } from "@/env.mjs"
import { abiInterfaces, buildPolicies } from "@/config/policies"

// Shared root-quorum / policy-provisioning operations, used by both the Admin
// panel (src/components/admin-panel.tsx) and the new-user signup hook. All run
// client-side, stamped by the caller's live session (`httpClient` from
// useTurnkey()). Each is guarded by a state check so re-running is safe (e.g. a
// double-fired effect, or resuming a partial provision).

// The session HTTP client type, derived from useTurnkey() so we don't import
// the underlying SDK client type directly (it's a transitive dep).
type TurnkeyHttpClient = NonNullable<
  ReturnType<typeof useTurnkey>["httpClient"]
>

const POLICY_MANAGER_PUBLIC_KEY = env.NEXT_PUBLIC_POLICY_MANAGER_PUBLIC_KEY

export interface RootQuorum {
  threshold: number
  userIds: string[]
}

/** Read the sub-org's current root quorum ({threshold, userIds}). */
export async function readQuorum(
  client: TurnkeyHttpClient,
  organizationId: string
): Promise<RootQuorum> {
  const { configs } = await client.getOrganizationConfigs({ organizationId })
  const quorum = configs.quorum
  if (!quorum) throw new Error("Could not read the current root quorum.")
  return { threshold: quorum.threshold, userIds: quorum.userIds }
}

/**
 * Whether the sub-org was created within `withinMs`. Auto-provisioning uses this
 * so it only runs for a genuinely new sub-org: a fresh signup provisions moments
 * after the sub-org is created, whereas an established account is far older. We
 * take the creation time from the oldest user's `createdAt` — the root user is
 * created together with the sub-org, so it marks the sub-org's birth, and a
 * later sign-in never adds an older user. Returns true if no timestamp is
 * available. Deliberate migration via the Admin panel does not use this — its
 * purpose is to migrate existing sub-orgs.
 */
export async function subOrgIsFresh(
  client: TurnkeyHttpClient,
  organizationId: string,
  withinMs: number
): Promise<boolean> {
  const { users } = await client.getUsers({ organizationId })
  const createdAtMs = users
    .map((u) => Number(u.createdAt?.seconds ?? 0) * 1000)
    .filter((ms) => ms > 0)
  if (!createdAtMs.length) return true
  return Date.now() - Math.min(...createdAtMs) <= withinMs
}

/**
 * Add the Policy Manager as a root user, keeping the current threshold (a
 * reversible 1/2 seed). Idempotent: if the quorum already has >1 member, it's a
 * no-op. Returns whether it added the user.
 */
export async function addPolicyManager(
  client: TurnkeyHttpClient,
  organizationId: string
): Promise<{ added: boolean }> {
  if (!POLICY_MANAGER_PUBLIC_KEY) {
    throw new Error("NEXT_PUBLIC_POLICY_MANAGER_PUBLIC_KEY is not set.")
  }
  const quorum = await readQuorum(client, organizationId)
  if (quorum.userIds.length > 1) return { added: false }

  const { userIds } = await client.createUsers({
    organizationId,
    users: [
      {
        userName: "Policy Manager",
        apiKeys: [
          {
            apiKeyName: "policy-manager",
            publicKey: POLICY_MANAGER_PUBLIC_KEY,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
        userTags: [],
      },
    ],
  })
  await client.updateRootQuorum({
    organizationId,
    threshold: quorum.threshold,
    userIds: [...quorum.userIds, userIds[0]],
  })
  return { added: true }
}

/**
 * Set the root-quorum threshold, re-sending the existing userIds
 * (updateRootQuorum overwrites the set). Idempotent: no-op if already at
 * `threshold`. At a 2/2 sub-org a downgrade lands in CONSENSUS_NEEDED awaiting
 * the Policy Manager's approval; a 1→2 bump executes immediately.
 */
export async function setThreshold(
  client: TurnkeyHttpClient,
  organizationId: string,
  threshold: number
): Promise<void> {
  const quorum = await readQuorum(client, organizationId)
  if (quorum.threshold === threshold) return
  await client.updateRootQuorum({
    organizationId,
    threshold,
    userIds: quorum.userIds,
  })
}

/**
 * Upload the configured ABIs + create the policy set. Idempotent: skips ABIs by
 * address and policies by name. `notes` is required on the ABI upload, so it's
 * always included. `endUserId` scopes the self-service wallet policy
 * (create/import/export) to
 * that user so the Policy Manager can't run those unilaterally; omitting it
 * skips that policy (see buildPolicies).
 */
export async function applyPolicySet(
  client: TurnkeyHttpClient,
  organizationId: string,
  endUserId?: string
): Promise<{ abisUploaded: number; policiesCreated: number }> {
  const { smartContractInterfaces } = await client.getSmartContractInterfaces({
    organizationId,
  })
  const haveAddr = new Set(
    smartContractInterfaces.map((i) => i.smartContractAddress.toLowerCase())
  )
  let abisUploaded = 0
  for (const i of abiInterfaces()) {
    if (haveAddr.has(i.address.toLowerCase())) continue
    await client.createSmartContractInterface({
      organizationId,
      smartContractAddress: i.address,
      smartContractInterface: JSON.stringify(i.abi),
      type: i.type,
      label: i.label,
      notes: `ERC-20 transfer ABI (${i.label})`,
    })
    abisUploaded++
  }

  const { policies: existing } = await client.getPolicies({ organizationId })
  const haveName = new Set(existing.map((p) => p.policyName))
  const toCreate = buildPolicies(endUserId).filter(
    (p) => !haveName.has(p.policyName)
  )
  if (toCreate.length) {
    await client.createPolicies({ organizationId, policies: toCreate })
  }
  return { abisUploaded, policiesCreated: toCreate.length }
}

/**
 * Full new-sub-org provisioning, in the order that never bricks: policies +
 * ABIs FIRST, then add Policy Manager, then bump to 2/2 (a born-2/2 sub-org
 * with no policies would be unusable). Each step is individually guarded, so a
 * partial/interrupted run resumes cleanly on a later call.
 */
export async function provisionNewSubOrg(
  client: TurnkeyHttpClient,
  organizationId: string,
  endUserId?: string
): Promise<void> {
  await applyPolicySet(client, organizationId, endUserId)
  await addPolicyManager(client, organizationId)
  await setThreshold(client, organizationId, 2)
}

// An activity that's been waiting on a co-signature past the 24h consensus
// window can no longer be approved/rejected — the original vote's short-lived
// session credential has expired. The activity stays CONSENSUS_NEEDED, so we
// infer expiry from age, matching how the dashboard shows "Expired".
const CONSENSUS_WINDOW_MS = 24 * 60 * 60 * 1000
function isExpired(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > CONSENSUS_WINDOW_MS
}

export interface PendingActivity {
  id: string
  type: string
  fingerprint: string
  createdAt: Date
  expired: boolean
}

/**
 * Pending (CONSENSUS_NEEDED) activities that await THIS user's co-signature —
 * i.e. changes someone else (the Policy Manager) submitted. Excludes activities
 * the user has already voted on: `canApprove` alone is NOT enough, because
 * Turnkey records the submitter's own vote yet still returns `canApprove: true`
 * for them — so a user's own pending sends would otherwise show up here. We
 * therefore drop any activity where `currentUserId` is already among the votes.
 */
export async function listPendingApprovals(
  client: TurnkeyHttpClient,
  organizationId: string,
  currentUserId: string
): Promise<PendingActivity[]> {
  const { activities } = await client.getActivities({
    organizationId,
    filterByStatus: ["ACTIVITY_STATUS_CONSENSUS_NEEDED"],
  })
  return activities
    .filter(
      (a) =>
        a.canApprove && !(a.votes ?? []).some((v) => v.userId === currentUserId)
    )
    .map((a) => {
      const createdAt = new Date(Number(a.createdAt?.seconds ?? 0) * 1000)
      return {
        id: a.id,
        type: a.type,
        fingerprint: a.fingerprint,
        createdAt,
        expired: isExpired(createdAt),
      }
    })
}

/**
 * The current user's OWN pending (CONSENSUS_NEEDED) activities — actions they
 * submitted that are now waiting on the Policy Manager's co-signature. This is
 * the complement of listPendingApprovals (things awaiting THIS user): here the
 * user is already among the votes, so what remains is the other member's
 * approval. Read-only in the app; the PM approves/rejects from the script side.
 */
export async function listAwaitingCoSignature(
  client: TurnkeyHttpClient,
  organizationId: string,
  currentUserId: string
): Promise<PendingActivity[]> {
  const { activities } = await client.getActivities({
    organizationId,
    filterByStatus: ["ACTIVITY_STATUS_CONSENSUS_NEEDED"],
  })
  return activities
    .filter((a) => (a.votes ?? []).some((v) => v.userId === currentUserId))
    .map((a) => {
      const createdAt = new Date(Number(a.createdAt?.seconds ?? 0) * 1000)
      return {
        id: a.id,
        type: a.type,
        fingerprint: a.fingerprint,
        createdAt,
        expired: isExpired(createdAt),
      }
    })
}

/** Co-sign (approve) a pending activity by fingerprint. */
export async function approvePendingActivity(
  client: TurnkeyHttpClient,
  organizationId: string,
  fingerprint: string
): Promise<void> {
  await client.approveActivity({ organizationId, fingerprint })
}

/** Reject a pending activity by fingerprint. */
export async function rejectPendingActivity(
  client: TurnkeyHttpClient,
  organizationId: string,
  fingerprint: string
): Promise<void> {
  await client.rejectActivity({ organizationId, fingerprint })
}

/**
 * Recipient addresses currently allow-listed for sends on `chainId`, read from
 * the LIVE policies (not the static config) so it always reflects what's
 * actually enforced on this sub-org — surviving policy edits, per-sub-org
 * differences, and stale build-time config.
 *
 * The recipients live in the `… in ['0x…', …]` clause of the demo testnet
 * native/USDC rules (whose condition format we own). We deliberately parse only
 * that `in […]` list — NOT every 0x address — so the USDC rule's bare
 * `eth.tx.to == '<contract>'` (the token contract) is never mistaken for a
 * recipient. Returns lowercased addresses; empty ⇒ no allowlist on this chain
 * (e.g. mainnet / Solana are allow-any), which the caller treats as "any
 * address". Fails safe: it can only ever surface addresses that appear inside a
 * live allow condition, so it can't overstate what's permitted.
 */
export async function getAllowedRecipients(
  client: TurnkeyHttpClient,
  organizationId: string,
  chainId: number
): Promise<string[]> {
  const { policies } = await client.getPolicies({ organizationId })
  const names = new Set([
    `demo-testnet-native-${chainId}`,
    `demo-testnet-usdc-${chainId}`,
  ])
  const out = new Set<string>()
  for (const p of policies) {
    if (!names.has(p.policyName)) continue
    const inList = p.condition?.match(/\bin\s*\[([^\]]*)\]/)
    if (!inList) continue
    for (const addr of inList[1].match(/0x[0-9a-fA-F]{40}/g) ?? []) {
      out.add(addr.toLowerCase())
    }
  }
  return [...out]
}
