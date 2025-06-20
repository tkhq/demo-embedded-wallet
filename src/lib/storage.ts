import type { UserSession } from "@/types/turnkey"

// Utility helpers for browser storage operations
// These helpers wrap the standard Web Storage API and provide typed
// convenience functions for working with the Turnkey demo app.

// Generic helpers ---------------------------------------------------------

/**
 * Safely read and JSON-parse a value from localStorage.
 *
 * @param key The storage key.
 * @returns Parsed value or `null` when the key doesn't exist or JSON fails.
 */
export const readLocalStorage = <T = unknown>(key: string): T | null => {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch (error) {
    console.error(`[storage] Failed to read key "${key}":`, error)
    return null
  }
}

/**
 * Stringify and store a value in localStorage.
 *
 * @param key The storage key.
 * @param value Any JSON-serialisable value.
 */
export const writeLocalStorage = <T = unknown>(key: string, value: T): void => {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`[storage] Failed to write key "${key}":`, error)
  }
}

/**
 * Remove a key from localStorage.
 */
export const removeLocalStorage = (key: string): void => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.error(`[storage] Failed to remove key "${key}":`, error)
  }
}

// App-specific helpers -----------------------------------------------------

export const SESSION_STORAGE_KEY = "@turnkey/session/v1"
export const OTP_ID_STORAGE_KEY = "@turnkey/otpId"

export const getSessionFromStorage = (): UserSession | null =>
  readLocalStorage<UserSession>(SESSION_STORAGE_KEY)

export const setSessionInStorage = (session: UserSession): void =>
  writeLocalStorage<UserSession>(SESSION_STORAGE_KEY, session)

export const removeSessionFromStorage = (): void =>
  removeLocalStorage(SESSION_STORAGE_KEY)

export const getOtpIdFromStorage = (): string | null =>
  readLocalStorage<string>(OTP_ID_STORAGE_KEY)

export const setOtpIdInStorage = (otpId: string): void =>
  writeLocalStorage<string>(OTP_ID_STORAGE_KEY, otpId)

export const removeOtpIdFromStorage = (): void =>
  removeLocalStorage(OTP_ID_STORAGE_KEY)
