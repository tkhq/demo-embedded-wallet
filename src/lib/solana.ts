import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token"
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js"

// Lamports per SOL (1 SOL = 1e9 lamports).
export const LAMPORTS_PER_SOL = 1_000_000_000

/**
 * Build an unsigned native-SOL transfer and return it hex-encoded for Turnkey's
 * `handleSendTransaction` (`unsignedTransaction`).
 *
 * No RPC is used: we intentionally leave `recentBlockhash` as a zeroed
 * placeholder so Turnkey fetches a fresh blockhash and sets competitive
 * compute/priority fees at broadcast time. The System Program transfer keeps the
 * transaction inside Turnkey's sponsored-flow constraints (System Program in
 * static keys, a single Turnkey signer, no top-level account creation).
 */
export const buildUnsignedSolTransfer = (
  fromBase58: string,
  toBase58: string,
  lamports: number
): string => {
  const from = new PublicKey(fromBase58)
  const to = new PublicKey(toBase58)

  const tx = new Transaction()
  tx.add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports,
    })
  )
  tx.feePayer = from
  // Placeholder blockhash — Turnkey overwrites it at broadcast time.
  tx.recentBlockhash = PublicKey.default.toBase58()

  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  })

  return serialized.toString("hex")
}

/**
 * Build an unsigned SPL token transfer, hex-encoded for Turnkey's
 * `handleSendTransaction`. Like the native builder, the blockhash is left as a
 * placeholder for Turnkey to fill.
 *
 * We can't check whether the recipient's associated token account (ATA) exists
 * without an RPC, so we prepend an *idempotent* ATA-create (a no-op when it
 * already exists). When it does create the ATA, that requires rent — so a
 * sponsored SPL send needs "Sponsor Solana Rent" enabled in the Turnkey
 * dashboard. `fromOwner` is the single Turnkey signer and the token authority.
 */
export const buildUnsignedSplTransfer = (
  fromOwnerBase58: string,
  toOwnerBase58: string,
  mintBase58: string,
  amountAtomic: bigint,
  decimals: number
): string => {
  const fromOwner = new PublicKey(fromOwnerBase58)
  const toOwner = new PublicKey(toOwnerBase58)
  const mint = new PublicKey(mintBase58)

  const fromAta = getAssociatedTokenAddressSync(mint, fromOwner)
  const toAta = getAssociatedTokenAddressSync(mint, toOwner)

  const tx = new Transaction()
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      fromOwner, // payer (rent covered by Turnkey when rent sponsorship is on)
      toAta,
      toOwner,
      mint
    ),
    createTransferCheckedInstruction(
      fromAta,
      mint,
      toAta,
      fromOwner,
      amountAtomic,
      decimals
    )
  )
  tx.feePayer = fromOwner
  // Placeholder blockhash — Turnkey overwrites it at broadcast time.
  tx.recentBlockhash = PublicKey.default.toBase58()

  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("hex")
}

// Validate a base58 Solana address without touching the network.
export const isValidSolanaAddress = (value: string): boolean => {
  try {
    // Accept any well-formed 32-byte base58 public key (on- or off-curve).
    return new PublicKey(value).toBytes().length === 32
  } catch {
    return false
  }
}

// Convert a decimal SOL string to an integer lamport amount.
export const solToLamports = (sol: string): number =>
  Math.round(parseFloat(sol) * LAMPORTS_PER_SOL)
