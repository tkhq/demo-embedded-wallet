/**
 * Policy admin — standalone dev tool for iterating on the sub-org's ABIs and
 * policies while the design is being nailed down. NOT part of the app; the
 * Next.js app never imports this and stays backendless.
 *
 * Auth: signs headlessly with the "Policy Manager" API key, which is a root
 * member of the sub-org (added at 1/2), so no browser/session is needed. At
 * 1/2 that key alone meets root quorum — treat the private key as sensitive.
 *
 * Policy/ABI definitions live in src/config/policies.ts (shared with the app).
 *
 * Usage (reads .env.local automatically):
 *   pnpm tsx scripts/policy-admin.ts list              # current quorum, policies, ABIs
 *   pnpm tsx scripts/policy-admin.ts apply             # upload ABIs + create policies (idempotent)
 *     [--org <subOrgId>] [--user <endUserId>]          #   one-off override of TURNKEY_SUBORG_ID / END_USER_ID (e.g. back-fill a specific sub-org)
 *   pnpm tsx scripts/policy-admin.ts reset             # delete the demo- policies to re-tune
 *   pnpm tsx scripts/policy-admin.ts approve <all|admin|fp>  # PM-approve pending activities (admin = governance only, skips sends)
 *   pnpm tsx scripts/policy-admin.ts reject <all|fp>   # PM-reject pending activities
 *   pnpm tsx scripts/policy-admin.ts bump <1|2>        # PM-side set root-quorum threshold
 *
 * Required in .env.local:
 *   TURNKEY_POLICY_MANAGER_PRIVATE_KEY   # server-only — NEVER NEXT_PUBLIC_
 *   TURNKEY_SUBORG_ID                    # sub-org where Policy Manager is root (or pass --org)
 * Reused (already set for the app's dev action; a public key is safe to expose):
 *   NEXT_PUBLIC_POLICY_MANAGER_PUBLIC_KEY   # same value as the private key's pair
 * Optional:
 *   TURNKEY_POLICY_MANAGER_PUBLIC_KEY    # override the public key with a server-only name
 *   TURNKEY_API_BASE_URL                 # defaults to https://api.turnkey.com
 *
 * This script is dev/ops tooling; the policy definitions it uses now live in
 * src/config/policies.ts (shared with the app's provisioning + Admin panel).
 * Removing just this script: delete scripts/policy-admin.ts, `pnpm remove
 * @turnkey/sdk-server tsx`, drop the esbuild line from pnpm-workspace.yaml.
 */
import { Turnkey } from "@turnkey/sdk-server"

import {
  abiInterfaces,
  buildPolicies,
  END_USER_ID,
  POLICY_PREFIX,
  validateConfig,
} from "../src/config/policies"

// Load .env.local without a dotenv dependency. `loadEnvFile` exists on modern
// Node; cast so it typechecks regardless of the installed @types/node version.
const loadEnvFile = (process as { loadEnvFile?: (path: string) => void })
  .loadEnvFile
try {
  loadEnvFile?.(".env.local")
} catch {
  // .env.local is optional if the vars are already in the environment.
}

const {
  TURNKEY_API_BASE_URL = "https://api.turnkey.com",
  TURNKEY_POLICY_MANAGER_PRIVATE_KEY,
  TURNKEY_SUBORG_ID,
} = process.env

// The public key is the same value as the app's dev action uses — reuse the
// existing NEXT_PUBLIC var rather than duplicating it (public keys are safe to
// expose). A TURNKEY_-prefixed override is honored if you prefer a server name.
const POLICY_MANAGER_PUBLIC_KEY =
  process.env.TURNKEY_POLICY_MANAGER_PUBLIC_KEY ??
  process.env.NEXT_PUBLIC_POLICY_MANAGER_PUBLIC_KEY

// Optional CLI overrides so you can target a specific sub-org / end user for a
// one-off (e.g. back-filling an already-2/2 sub-org) WITHOUT editing .env.local
// or src/config/policies.ts. `--org` applies to every command; `--user` only
// scopes the self-service wallet policy that `apply` creates.
//   pnpm tsx scripts/policy-admin.ts apply --org <subOrgId> --user <endUserId>
function argFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  const val = i !== -1 ? process.argv[i + 1] : undefined
  // Guard against a flag with no value (e.g. `--org --user X`).
  return val && !val.startsWith("--") ? val : undefined
}

const org = () => argFlag("--org") ?? TURNKEY_SUBORG_ID ?? ""

function apiClient() {
  const missing = [
    ["NEXT_PUBLIC_POLICY_MANAGER_PUBLIC_KEY", POLICY_MANAGER_PUBLIC_KEY],
    ["TURNKEY_POLICY_MANAGER_PRIVATE_KEY", TURNKEY_POLICY_MANAGER_PRIVATE_KEY],
    ["TURNKEY_SUBORG_ID (or --org)", org()],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length) {
    console.error(`Missing env in .env.local: ${missing.join(", ")}`)
    process.exit(1)
  }
  return new Turnkey({
    apiBaseUrl: TURNKEY_API_BASE_URL,
    apiPublicKey: POLICY_MANAGER_PUBLIC_KEY!,
    apiPrivateKey: TURNKEY_POLICY_MANAGER_PRIVATE_KEY!,
    defaultOrganizationId: org(),
  }).apiClient()
}

async function list() {
  const api = apiClient()
  const { configs } = await api.getOrganizationConfigs({
    organizationId: org(),
  })
  const q = configs.quorum
  console.log(
    `Root quorum: ${q?.threshold}/${q?.userIds.length}` +
      (q ? ` — users: ${q.userIds.join(", ")}` : "")
  )

  const { policies } = await api.getPolicies({ organizationId: org() })
  console.log(`\nPolicies (${policies.length}):`)
  for (const p of policies) {
    console.log(`  [${p.effect.replace("EFFECT_", "")}] ${p.policyName}`)
  }

  const { smartContractInterfaces } = await api.getSmartContractInterfaces({
    organizationId: org(),
  })
  console.log(
    `\nSmart contract interfaces (${smartContractInterfaces.length}):`
  )
  for (const i of smartContractInterfaces) {
    console.log(`  ${i.label} — ${i.smartContractAddress}`)
  }
}

async function apply() {
  const problems = validateConfig()
  if (problems.length) {
    console.error("Config incomplete — populate src/config/policies.ts:")
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  const api = apiClient()
  console.log(`Sub-org: ${org()}`)

  // ABIs — idempotent by contract address.
  const { smartContractInterfaces } = await api.getSmartContractInterfaces({
    organizationId: org(),
  })
  const haveAddr = new Set(
    smartContractInterfaces.map((i) => i.smartContractAddress.toLowerCase())
  )
  const abis = abiInterfaces()
  let abiCreated = 0
  for (const i of abis) {
    if (haveAddr.has(i.address.toLowerCase())) continue
    await api.createSmartContractInterface({
      organizationId: org(),
      smartContractAddress: i.address,
      smartContractInterface: JSON.stringify(i.abi),
      type: i.type,
      label: i.label,
      // `notes` is required on the ABI upload, so always include a value.
      notes: `ERC-20 transfer ABI (${i.label})`,
    })
    abiCreated++
  }
  console.log(`ABIs: +${abiCreated} uploaded (${abis.length} configured)`)

  // Policies — idempotent by name.
  const { policies: existing } = await api.getPolicies({
    organizationId: org(),
  })
  const haveName = new Set(existing.map((p) => p.policyName))
  // Effective end user: the --user flag wins over the static END_USER_ID. Empty
  // ⇒ buildPolicies skips the user-scoped self-service wallet policy, so those
  // ops escalate to co-sign at 2/2 (and the user can't export unilaterally).
  const endUser = (argFlag("--user") ?? END_USER_ID).trim()
  if (!endUser) {
    console.warn(
      "⚠ No end user set — skipping the self-service wallet policy " +
        "(create/add/import/export). Pass --user <endUserId> or set " +
        "END_USER_ID in src/config/policies.ts to include it."
    )
  }
  const defined = buildPolicies(endUser || undefined)
  const toCreate = defined.filter((p) => !haveName.has(p.policyName))
  if (!toCreate.length) {
    console.log(
      `Policies: none to create (${defined.length} defined, all present).`
    )
    return
  }
  // createPolicies is a root action, so at a 2/2 quorum the PM alone can't
  // complete it — Turnkey holds it as CONSENSUS_NEEDED awaiting the end user's
  // co-sign. Report that as "submitted, pending approval" rather than a
  // misleading "+N created", handling both the returned-pending and
  // thrown-consensus shapes (mirrors `bump`).
  try {
    const { activity } = await api.createPolicies({
      organizationId: org(),
      policies: toCreate,
    })
    if (activity.status === "ACTIVITY_STATUS_CONSENSUS_NEEDED") {
      console.log(
        `Policies: ${toCreate.length} submitted — pending co-signer approval ` +
          `(fingerprint ${activity.fingerprint}; co-sign in the app's Pending ` +
          "approvals, or with `approve`)."
      )
      return
    }
    console.log(
      `Policies: +${toCreate.length} created (${defined.length} defined).`
    )
  } catch (err) {
    const msg =
      err instanceof Error ? `${err.name} ${err.message}` : String(err)
    if (/consensus/i.test(msg)) {
      console.log(
        `Policies: ${toCreate.length} submitted — pending co-signer approval ` +
          "(co-sign in the app's Pending approvals, or with `approve`)."
      )
      return
    }
    throw err
  }
}

async function reset() {
  const api = apiClient()
  const { policies } = await api.getPolicies({ organizationId: org() })
  const ids = policies
    .filter((p) => p.policyName.startsWith(POLICY_PREFIX))
    .map((p) => p.policyId)
  if (!ids.length) {
    console.log(`No "${POLICY_PREFIX}" policies to delete.`)
    return
  }
  await api.deletePolicies({ organizationId: org(), policyIds: ids })
  console.log(`Deleted ${ids.length} "${POLICY_PREFIX}" policies.`)
}

// Is this activity a governance/admin action the Policy Manager may safely
// BATCH co-sign? Matched by family so versioned types (…_V2/V3) are covered.
// The NEVER list is a hard backstop: anything that signs or moves funds is
// excluded from batch approval no matter what — those require an explicit
// fingerprint so a bulk `approve admin` can never rubber-stamp a user's
// transaction. New/unknown types fall through to "not admin" (safe default).
const NEVER_BATCH = [
  "SIGN",
  "SEND",
  "EXPORT",
  "SWAP",
  "EARN",
  "RAW_PAYLOAD",
  "SPARK",
]
const ADMIN_FAMILIES = [
  "POLIC",
  "ROOT_QUORUM",
  "SMART_CONTRACT_INTERFACE",
  "_USER",
]
function isAdminActivity(type: string): boolean {
  if (NEVER_BATCH.some((f) => type.includes(f))) return false
  return ADMIN_FAMILIES.some((f) => type.includes(f))
}

// Apply approve/reject across a set of activities, resilient per item: a
// failure on one (e.g. a stale proposal that can no longer be approved or
// rejected) is reported and skipped instead of aborting the whole batch.
async function applyDecision(
  api: ReturnType<typeof apiClient>,
  items: { type: string; fingerprint: string }[],
  action: "approve" | "reject"
) {
  const past = action === "approve" ? "Approved" : "Rejected"
  let done = 0
  let skipped = 0
  for (const a of items) {
    const fp = a.fingerprint.slice(0, 20)
    try {
      if (action === "approve") {
        await api.approveActivity({ organizationId: org(), fingerprint: a.fingerprint })
      } else {
        await api.rejectActivity({ organizationId: org(), fingerprint: a.fingerprint })
      }
      console.log(`${past} ${a.type} (${fp}).`)
      done++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const stale = /original proposal is missing|SIGNATURE_MISSING/i.test(msg)
      console.log(
        `Skipped ${a.type} (${fp}) — ${stale ? "expired/stale proposal (re-submit to act on it)" : msg}`
      )
      skipped++
    }
  }
  console.log(`Done: ${done} ${past.toLowerCase()}, ${skipped} skipped.`)
}

// Approve pending (CONSENSUS_NEEDED) activities with the PM key. Three explicit
// modes — no dangerous implicit default:
//   approve all           every pending activity (incl. transaction sends)
//   approve admin         only governance types (policy/quorum/interface/user);
//                         transaction sends are skipped + reported
//   approve <fingerprint> exactly one activity, any type
async function approve() {
  const mode = process.argv[3]
  if (!mode) {
    console.error(
      "Usage: pnpm tsx scripts/policy-admin.ts approve <all|admin|fingerprint>"
    )
    process.exit(1)
  }
  const api = apiClient()
  const { activities } = await api.getActivities({
    organizationId: org(),
    filterByStatus: ["ACTIVITY_STATUS_CONSENSUS_NEEDED"],
  })
  const pending = activities.filter((a) => a.canApprove)
  if (!pending.length) {
    console.log("No pending activities to approve.")
    return
  }

  let toApprove
  if (mode === "all") {
    toApprove = pending
  } else if (mode === "admin") {
    toApprove = pending.filter((a) => isAdminActivity(a.type))
    for (const a of pending.filter((a) => !isAdminActivity(a.type))) {
      console.log(
        `Skipped (not admin — use \`approve ${a.fingerprint}\` if intended): ${a.type}`
      )
    }
  } else {
    // treat the arg as a fingerprint
    toApprove = pending.filter((a) => a.fingerprint === mode)
    if (!toApprove.length) {
      console.error(`No pending activity with fingerprint ${mode}.`)
      process.exit(1)
    }
  }

  if (!toApprove.length) {
    console.log("Nothing to approve for this mode.")
    return
  }
  await applyDecision(api, toApprove, "approve")
}

// Reject pending (CONSENSUS_NEEDED) activities with the PM key — e.g. decline a
// user-submitted send that's stuck awaiting the PM's vote. Explicit mode only:
//   reject all           every pending activity the PM can reject
//   reject <fingerprint> exactly one activity
async function reject() {
  const mode = process.argv[3]
  if (!mode) {
    console.error(
      "Usage: pnpm tsx scripts/policy-admin.ts reject <all|fingerprint>"
    )
    process.exit(1)
  }
  const api = apiClient()
  const { activities } = await api.getActivities({
    organizationId: org(),
    filterByStatus: ["ACTIVITY_STATUS_CONSENSUS_NEEDED"],
  })
  const pending = activities.filter((a) => a.canReject)
  if (!pending.length) {
    console.log("No pending activities to reject.")
    return
  }

  let toReject
  if (mode === "all") {
    toReject = pending
  } else {
    toReject = pending.filter((a) => a.fingerprint === mode)
    if (!toReject.length) {
      console.error(`No pending activity with fingerprint ${mode}.`)
      process.exit(1)
    }
  }
  await applyDecision(api, toReject, "reject")
}

// Set the root-quorum threshold from the PM side. At 1/2 the PM alone can bump
// to 2; a 2→1 downgrade needs the user too, so it will land in
// CONSENSUS_NEEDED awaiting their approval.
async function bump() {
  const threshold = Number(process.argv[3])
  if (threshold !== 1 && threshold !== 2) {
    console.error("Usage: pnpm tsx scripts/policy-admin.ts bump <1|2>")
    process.exit(1)
  }
  const api = apiClient()
  const { configs } = await api.getOrganizationConfigs({
    organizationId: org(),
  })
  const quorum = configs.quorum
  if (!quorum) {
    console.error("Could not read the current root quorum.")
    process.exit(1)
  }
  if (quorum.threshold === threshold) {
    console.log(`Root quorum already at threshold ${threshold}.`)
    return
  }
  const target = `${threshold}/${quorum.userIds.length}`
  // The PM alone can complete a 1→2 bump (sufficient at threshold 1), but a
  // 2→1 downgrade needs the other root member — Turnkey holds it as
  // CONSENSUS_NEEDED awaiting their co-sign. Handle both the returned-pending
  // and thrown-consensus cases so this reports cleanly instead of erroring.
  try {
    const { activity } = await api.updateRootQuorum({
      organizationId: org(),
      threshold,
      userIds: quorum.userIds,
    })
    if (activity.status === "ACTIVITY_STATUS_CONSENSUS_NEEDED") {
      console.log(
        `Root quorum ${target} requested — pending co-signer approval (fingerprint ${activity.fingerprint}).`
      )
      return
    }
    console.log(`Root quorum threshold set to ${target}.`)
  } catch (err) {
    const msg =
      err instanceof Error ? `${err.name} ${err.message}` : String(err)
    if (/consensus/i.test(msg)) {
      console.log(
        `Root quorum ${target} requested — pending co-signer approval (co-sign it in the app's Pending approvals, or with \`approve\`).`
      )
      return
    }
    throw err
  }
}

const commands = { list, apply, reset, approve, reject, bump }
const cmd = process.argv[2] as keyof typeof commands
if (!commands[cmd]) {
  console.error(
    "Usage: pnpm tsx scripts/policy-admin.ts <list|apply|reset|approve <all|admin|fingerprint>|reject <all|fingerprint>|bump <1|2>>\n" +
      "  overrides: --org <subOrgId> (any command), --user <endUserId> (apply)"
  )
  process.exit(1)
}
commands[cmd]().catch((err) => {
  console.error(err)
  process.exit(1)
})
