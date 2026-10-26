import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const truncateAddress = (
  address: string,
  { prefix = 8, suffix = 4 }: { prefix?: number; suffix?: number } = {}
) => {
  return `${address.slice(0, prefix)}•••${address.slice(-suffix)}`
}

/**
 * True when a rejected promise represents the user simply dismissing a modal or
 * OAuth popup (rather than a real failure) — a `TurnkeyError` whose `code` is
 * `USER_CANCELED`, matched by its string code. Callers use this to swallow
 * cancellations instead of surfacing an error toast or letting the rejection go
 * unhandled.
 */
export const isUserCancelError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "USER_CANCELED"

/**
 * True when a send didn't complete because the send-transaction activity
 * produced no status id — surfaced as a "Missing sendTransactionStatusId"
 * error. In this app that most commonly means the transfer needs a co-signature
 * (it isn't covered by policy). The same condition can also arrive as a separate
 * unhandled promise rejection, so we use this both to message it in the send
 * catch and to suppress the stray rejection (see RwkRejectionGuard).
 */
export const isSendRejectedError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : ""
  return /sendTransactionStatusId/i.test(message)
}

export const getRpId = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.hostname
  } catch (error) {
    console.error("Invalid URL:", error)
    return null
  }
}
