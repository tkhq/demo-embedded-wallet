# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build production bundle (`pnpm build:local` skips env validation)
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` / `pnpm format:check` - Prettier over `src/`
- `npx tsc --noEmit -p .` - Type-check
- `pnpm tsx scripts/policy-admin.ts <cmd>` - Policy admin CLI (see Co-signing below)

There is no test suite; verify changes by running the app.

## Architecture Overview

Turnkey embedded wallet demo on Next.js 16 (App Router), React 19, Tailwind 4 +
shadcn/ui, and `@turnkey/react-wallet-kit` (RWK) 2.x.

**The app is backendless.** There are no server actions, API routes, server API
keys, or third-party RPC/indexers. Auth, signing, balances, and broadcasting all
go from the browser to Turnkey, stamped by the user's session (`useTurnkey()`).
Keep it that way.

**Configuration is dashboard-managed.** Enabled auth methods, OAuth client IDs
(Google, Apple, Facebook, X, Discord), the OAuth redirect URL, session length,
and OTP settings live in the Turnkey dashboard (Embedded Wallets →
Configuration) and reach the SDK through the Auth Proxy's `wallet_kit_config`.
Don't move them into code or env. RWK resolves each setting as
`in-code config ?? Auth Proxy config`. The live proxy config can be inspected with
`POST https://authproxy.turnkey.com/v1/wallet_kit_config` and header
`X-Auth-Proxy-Config-ID`.

**Environment** (`src/env.mjs`, `@t3-oss/env-nextjs`, empty strings = unset):

- Required: `NEXT_PUBLIC_ORGANIZATION_ID`, `NEXT_PUBLIC_AUTH_PROXY_ID`
- Optional: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_AUTH_PROXY_URL`,
  `NEXT_PUBLIC_OAUTH_REDIRECT_URI` (local-dev override of the dashboard
  redirect, shared by all providers), `NEXT_PUBLIC_POLICY_MANAGER_PUBLIC_KEY`
- CLI only, never `NEXT_PUBLIC_`: `TURNKEY_POLICY_MANAGER_PRIVATE_KEY`,
  `TURNKEY_SUBORG_ID`

### Providers

```
ThemeProvider (forced light)                     src/providers/index.tsx
  └─ TurnkeyConfigProvider                       src/providers/config/config-provider.tsx
      └─ TurnkeyProvider (RWK) + ConfigPanel
```

`TurnkeyConfigProvider` holds a mutable copy of the static config in
`src/config/turnkey.ts`. The Config Panel (`src/components/config-panel.tsx`,
opened from the login card) overrides which auth methods show; changes
re-initialize the client and reset on reload.

The dashboard layout adds `AuthGuard` → `WalletsProvider`
(`src/providers/wallet-provider.tsx`: accounts, network mode, balances).

### Routes

- `(landing)` behind `InverseAuthGuard`: `/` (login card, `src/components/auth.tsx`)
  and `/verify-email` (OTP entry, completes email and passkey sign-up)
- `(dashboard)` behind `AuthGuard`: `/dashboard` (wallet card, assets,
  send/receive) and `/settings` (login methods, passkeys, Admin panel)

Both guards key on RWK `authState`. `AuthGuard` waits for `clientState` to be
ready before redirecting, because `authState` starts as unauthenticated on every
page load.

### Auth

- **Email OTP**: `initOtp` → `/verify-email` → `completeOtp`. The OTP encryption
  bundle is carried between pages in `sessionStorage`.
- **Passkey**: `proxyGetAccount` decides login vs. sign-up. Sign-up verifies
  the email by OTP, then calls `signUpWithOtp` with the passkey as the
  authenticator. Don't switch it to `signUpWithPasskey`: that omits the OTP
  client signature and the backend rejects it.
- **OAuth / external wallet**: RWK `handle*Oauth({ openInPage: true })` and
  `loginOrSignupWithWallet`. No callback routes.
- Each authenticator gets its own sub-org. The same email via different methods
  is a separate account by design. Don't add email-based account linking
  (account-takeover risk).

### Wallets, networks, sending

- New sub-orgs get a "Default Wallet" with one Ethereum (secp256k1) and one
  Solana (ed25519) account (`customWallet` in `src/config/turnkey.ts`).
  `WalletsProvider` backfills the Solana account for older wallets.
- Chains are defined in `src/config/networks.ts`: Ethereum, Base, and Solana,
  each with mainnet and testnet CAIP-2 IDs. All EVM chains share one address.
  The global Mainnet/Testnet toggle defaults to testnet.
- Balances come from Turnkey's Balances API. Testnet USD values use Coinbase
  mainnet spot prices (`src/lib/prices.ts`).
- Sends use `handleSendTransaction` with `sponsor: true` (gas sponsorship must be
  enabled for the org). ERC-20 calldata is built in `src/lib/evm.ts`. Solana
  transfers are built without an RPC (`src/lib/solana.ts`); Turnkey fills the
  blockhash.

### Co-signing and policies

- New sub-orgs are provisioned on first load after sign-up
  (`src/components/provision-on-signup.tsx`): policies and ABIs from
  `src/config/policies.ts` are applied, the "Policy Manager" API key is added as
  a root user, and root quorum is raised to 2/2. The logic is in
  `src/lib/root-quorum.ts` and is idempotent.
- Settings → Admin shows root quorum, pending approvals (co-sign or reject
  Policy Manager changes) and the user's own actions awaiting co-signature.
- `scripts/policy-admin.ts` is the Policy Manager's operator CLI (`list`,
  `apply`, `reset`, `approve`, `reject`, `bump`). It signs with the private key
  and is never imported by the app.

## Gotchas

- `@turnkey/react-wallet-kit/styles.css` ships a full Tailwind build. Import it
  before `globals.css` (`src/app/layout.tsx`) or it overrides app utilities.
- `next.config.js` aliases RWK's React Native passkey packages to
  `stubs/empty-module.js`; Turbopack fails without it.
- TypeScript is capped at 6.x (Next 16's type-check fails on TS 7) and ESLint at
  9.x (`eslint-config-next` peer range).
- `eslint-config-next` enforces React Compiler rules (`react-hooks/purity`,
  `set-state-in-effect`, …). Fix the code rather than disabling them.
- This is a public reference demo: keep code comments factual and neutral about
  Turnkey APIs and SDKs.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
