import type { TCreatePoliciesBody } from "@turnkey/sdk-server"

// Single source of truth for the demo's ABI + policy definitions used by the
// standalone admin tool (scripts/policy-admin.ts). Self-contained on purpose —
// nothing in the app imports this, so teardown is `rm scripts/policy-*`.

type PolicyIntent = TCreatePoliciesBody["policies"][number]

// Prefix so `reset` deletes only policies this tool created.
export const POLICY_PREFIX = "demo-"

// eip155 chain ids.
const MAINNET_CHAIN_IDS = [1, 8453] // Ethereum, Base
const TESTNET_CHAIN_IDS = [11155111, 84532] // Sepolia, Base Sepolia

// ─── PLACEHOLDERS — populate before running `apply` ────────────────────────

// Testnet allowlisted recipient(s), PER CHAIN — addresses you control. This is
// the policy-enforcement DEMO surface: sending testnet USDC to a chain's listed
// recipient → allowed; anywhere else → denied (the safe "watch it block"
// moment). Per-chain because each testnet's hot wallet / paymaster differs, and
// a Sepolia send shouldn't be allowed to the Base recipient (or vice versa).
// Mainnet is deliberately unrestricted (see the mainnet rule in buildPolicies).
export const TESTNET_ALLOWED_RECIPIENTS: Record<number, string[]> = {
  11155111: ["0x31Ad96066a208CeabcE11cc756c790782A199123"], // Ethereum Sepolia
  84532: ["0xd5aa5C77cDE69f5F5C64e8E17b3eC25106610a6f"], // Base Sepolia
}

// USDC token contracts per network (canonical Circle USDC, verified against
// developers.circle.com/stablecoins/usdc-contract-addresses). Leave "" to skip.
// Only the TESTNET entries are currently referenced (the testnet mirror rule +
// its ABI upload); mainnet is unrestricted, so the mainnet entries are kept as
// verified reference in case a mainnet restriction is reintroduced later.
export const USDC = {
  ethereumMainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // chain 1
  baseMainnet: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // chain 8453
  sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // chain 11155111
  baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // chain 84532
}

// Optional: pin an end-user's userId in `consensus`. Empty = condition-only
// (any user in the sub-org), which in a single-user sub-org is the end user.
//
// KEEP THIS EMPTY in the committed repo. The app scopes the self-service wallet
// policy via the LIVE session user (buildPolicies(user.userId)); this static
// value only feeds the standalone script. Set it TEMPORARILY — and reset it
// after — to back-fill ONE specific sub-org via scripts/policy-admin.ts. A
// committed non-empty value would mis-scope the transfer rules for
// app-provisioned sub-orgs (pinning them to the wrong user).
export const END_USER_ID = ""

// Backstop denying raw-payload signing so the eth.tx rules can't be bypassed.
// OFF by default — enable only after confirming it doesn't break a legit app
// flow (e.g. login/session signing).
export const INCLUDE_RAW_SIGN_DENY = false

// ───────────────────────────────────────────────────────────────────────────

// Solana USDC mints (canonical Circle USDC, verified against Circle's list).
// Both clusters' mints are listed so the Solana USDC rule matches on devnet and
// mainnet alike. NOTE: Solana addresses are case-sensitive base58 — never
// lowercase them (unlike EVM hex).
export const SOLANA_USDC_MINTS = [
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // mainnet
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // devnet
]

// Standard ERC-20 transfer ABI. Arg is named `recipient` (NOT `to`) so policies
// read `contract_call_args['recipient']` — unambiguously the token recipient,
// distinct from `eth.tx.to` (the token CONTRACT). Uploaded once per address.
export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
]

const lc = (a: string) => a.toLowerCase()
// EVM address list — lowercased (hex is case-insensitive).
const addrList = (addrs: string[]) =>
  "[" + addrs.map((a) => `'${lc(a)}'`).join(", ") + "]"
// Solana address list — case PRESERVED (base58 is case-sensitive).
const solList = (addrs: string[]) =>
  "[" + addrs.map((a) => `'${a}'`).join(", ") + "]"
const chainIn = (ids: number[]) =>
  "(" + ids.map((i) => `eth.tx.chain_id == ${i}`).join(" || ") + ")"

// USDC entries with a non-empty address, tagged with their chain id.
export function configuredUsdc(): {
  label: string
  address: string
  chainId: number
}[] {
  return [
    { label: "USDC (Ethereum)", address: USDC.ethereumMainnet, chainId: 1 },
    { label: "USDC (Base)", address: USDC.baseMainnet, chainId: 8453 },
    { label: "USDC (Sepolia)", address: USDC.sepolia, chainId: 11155111 },
    { label: "USDC (Base Sepolia)", address: USDC.baseSepolia, chainId: 84532 },
  ].filter((e) => e.address.trim() !== "")
}

// One ABI upload per TESTNET USDC address — only the testnet mirror inspects
// arguments. Mainnet allows any action, so no mainnet ABI is needed.
export function abiInterfaces() {
  return configuredUsdc()
    .filter((e) => TESTNET_CHAIN_IDS.includes(e.chainId))
    .map((e) => ({
      label: e.label,
      address: e.address,
      type: "SMART_CONTRACT_INTERFACE_TYPE_ETHEREUM" as const,
      abi: ERC20_ABI,
    }))
}

// Consensus clause scoping an ALLOW to one user — grants THAT user unilateral
// rights for the covered activities, even under a 2/2 root quorum (the other
// member's approval is not required). Used to keep self-service wallet ops
// (below) exercisable by the end user alone but NOT the Policy Manager.
const scoped = (userId: string) => `approvers.any(user, user.id == '${userId}')`

// Base consensus for the transfer/Solana rules — unchanged: driven only by the
// static END_USER_ID (empty ⇒ condition-only, i.e. any user in the sub-org).
const baseConsensus = END_USER_ID ? scoped(END_USER_ID) : undefined

// Self-service wallet activities the end user should be able to run alone at
// 2/2. Import is two-step (INIT_IMPORT_WALLET then IMPORT_WALLET); export is a
// single EXPORT_WALLET. Exact strings verified against @turnkey/http's
// v1ActivityType enum.
const SELF_SERVICE_WALLET_ACTIVITIES = [
  "ACTIVITY_TYPE_CREATE_WALLET",
  "ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS",
  "ACTIVITY_TYPE_INIT_IMPORT_WALLET",
  "ACTIVITY_TYPE_IMPORT_WALLET",
  "ACTIVITY_TYPE_EXPORT_WALLET",
]
const quote = (xs: string[]) => "[" + xs.map((x) => `'${x}'`).join(", ") + "]"

function policy(
  name: string,
  effect: "EFFECT_ALLOW" | "EFFECT_DENY",
  condition: string,
  notes: string,
  consensus: string | undefined = baseConsensus
): PolicyIntent {
  return {
    policyName: POLICY_PREFIX + name,
    effect,
    condition,
    ...(consensus ? { consensus } : {}),
    notes,
  }
}

// Build the full policy set from the config above. EVM rules pin
// `eth.tx.chain_id` to separate testnet/mainnet. Solana rules apply to both
// devnet and mainnet (see the Solana block below).
export function buildPolicies(endUserId?: string): PolicyIntent[] {
  const policies: PolicyIntent[] = []
  const usdc = configuredUsdc()
  const testnetUsdc = usdc.filter((e) => TESTNET_CHAIN_IDS.includes(e.chainId))

  // ── Testnet: native AND USDC only to this chain's allowlisted recipients
  //    (per-chain, so a Sepolia send can't be allowed to the Base recipient).
  //    Native uses eth.tx.to (the recipient); USDC uses contract_call_args. ──
  for (const chainId of TESTNET_CHAIN_IDS) {
    const recipients = TESTNET_ALLOWED_RECIPIENTS[chainId] ?? []
    policies.push(
      policy(
        `testnet-native-${chainId}`,
        "EFFECT_ALLOW",
        `eth.tx.chain_id == ${chainId} && eth.tx.data == '0x' && eth.tx.to in ${addrList(recipients)}`,
        "Testnet: native sends only to this chain's allowlisted recipients."
      )
    )
  }
  for (const t of testnetUsdc) {
    const recipients = TESTNET_ALLOWED_RECIPIENTS[t.chainId] ?? []
    policies.push(
      policy(
        `testnet-usdc-${t.chainId}`,
        "EFFECT_ALLOW",
        `eth.tx.chain_id == ${t.chainId} && eth.tx.to == '${lc(t.address)}' && eth.tx.function_name == 'transfer' && eth.tx.contract_call_args['recipient'] in ${addrList(recipients)}`,
        "Testnet: USDC transfer only to this chain's allowlisted recipients (the enforcement demo)."
      )
    )
  }

  // ── Mainnet: allow ANY action. Enforcement is demonstrated on testnet; we
  //    deliberately do NOT restrict mainnet so a user's own real funds can't get
  //    stuck (a paymaster-only rule could strand their deposits, and at 2/2 they
  //    couldn't remove it). Sponsored-gas abuse is bounded by the org
  //    windowLimitUsd cap + the demo's auth gate — not by policy. ──
  policies.push(
    policy(
      "mainnet-any",
      "EFFECT_ALLOW",
      chainIn(MAINNET_CHAIN_IDS),
      "Mainnet: allow any action (bounded by org gas limit + auth gate, not policy)."
    )
  )

  // ── Solana (Option A): allow native SOL + USDC-SPL transfers, any recipient,
  //    on both clusters. Turnkey parses SOL/SPL transfers natively (no IDL
  //    upload needed). These always apply — without them, a 2/2 bump would
  //    implicit-deny all Solana sends. Recipients aren't restricted here, so no
  //    token-account (ATA) handling — that only matters if you later allowlist
  //    SPL recipients. ──
  policies.push(
    policy(
      "solana-native",
      "EFFECT_ALLOW",
      // "contains >=1 native SOL transfer". `.any` is false on an empty list.
      // `amount >= 0` is an always-true presence predicate (amounts are
      // non-negative).
      `solana.tx.transfers.any(transfer, transfer.amount >= 0)`,
      "Solana: allow native SOL transfers (any recipient, both clusters)."
    )
  )
  policies.push(
    policy(
      "solana-usdc",
      "EFFECT_ALLOW",
      // "contains >=1 USDC SPL transfer". `.any` (not `.all`) so an empty list
      // can't vacuously match and non-USDC transfers fall through to deny.
      `solana.tx.spl_transfers.any(transfer, transfer.token_mint in ${solList(SOLANA_USDC_MINTS)})`,
      "Solana: allow USDC (SPL) transfers (any recipient, both clusters)."
    )
  )

  // ── Self-service wallet ops: let the END USER create wallets, add accounts,
  //    and import/export their OWN wallets unilaterally at 2/2 — scoped to their
  //    userId so the Policy Manager CANNOT (export is key extraction; keeping it
  //    user-only is what preserves non-custody, and at 2/2 the PM can't add a
  //    policy to grant itself export either). Without these, all five escalate
  //    to co-sign once the quorum is 2/2. Skipped when the user id is unknown —
  //    the app passes the session user; the script needs END_USER_ID set. ──
  const selfUser = (endUserId || END_USER_ID || "").trim()
  if (selfUser) {
    policies.push(
      policy(
        "self-wallet-ops",
        "EFFECT_ALLOW",
        `activity.type in ${quote(SELF_SERVICE_WALLET_ACTIVITIES)}`,
        "Self-service: end user may create / add-account / import / export their own wallets unilaterally; the Policy Manager cannot.",
        scoped(selfUser)
      )
    )
  }

  if (INCLUDE_RAW_SIGN_DENY) {
    policies.push(
      policy(
        "deny-raw-sign",
        "EFFECT_DENY",
        `activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2' && activity.params.encoding != 'PAYLOAD_ENCODING_EIP712'`,
        "Backstop: block raw-payload signing so eth.tx rules can't be bypassed."
      )
    )
  }

  return policies
}

// Problems that would make `apply` produce broken/incomplete rules.
export function validateConfig(): string[] {
  const problems: string[] = []
  const testnetUsdc = configuredUsdc().filter((e) =>
    TESTNET_CHAIN_IDS.includes(e.chainId)
  )
  if (testnetUsdc.length === 0)
    problems.push(
      "No testnet USDC address set in USDC{} — the testnet mirror rule needs one."
    )
  // Every testnet chain needs >=1 recipient: both the native and the USDC rule
  // are allowlisted per chain now, so an empty list means `to in []` (allows
  // nothing) on that chain.
  for (const chainId of TESTNET_CHAIN_IDS) {
    if ((TESTNET_ALLOWED_RECIPIENTS[chainId] ?? []).length === 0)
      problems.push(
        `TESTNET_ALLOWED_RECIPIENTS[${chainId}] is empty — testnet native + USDC rules on that chain need a recipient.`
      )
  }
  return problems
}
