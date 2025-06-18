"use client"

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react"
import { useRouter } from "next/navigation"
import {
  createUserSubOrg,
  getSubOrgId,
  getSubOrgIdByEmail,
  getSubOrgIdByPublicKey,
  initEmailAuth,
  oauth,
  otpLogin,
  verifyOtp,
} from "@/actions/turnkey"
import { googleLogout } from "@react-oauth/google"
import { uncompressRawPublicKey } from "@turnkey/crypto"
import { AuthClient, Session, SessionType } from "@turnkey/sdk-browser"
import { useTurnkey } from "@turnkey/sdk-react"
import { WalletType } from "@turnkey/wallet-stamper"
import { toHex } from "viem"

import { Email, UserSession } from "@/types/turnkey"
import {
  getOtpIdFromStorage,
  removeOtpIdFromStorage,
  setOtpIdInStorage,
  setSessionInStorage,
} from "@/lib/storage"

export const loginResponseToUser = (
  loginResponse: {
    organizationId: string
    organizationName: string
    userId: string
    username: string
    session?: string
    sessionExpiry?: string
  },
  authClient: AuthClient
): UserSession => {
  const subOrganization = {
    organizationId: loginResponse.organizationId,
    organizationName: loginResponse.organizationName,
  }

  let read: Session | undefined
  if (loginResponse.session) {
    // @ts-expect-error - Turnkey SDK types are not up to date
    read = {
      token: loginResponse.session,
      expiry: Number(loginResponse.sessionExpiry),
    }
  }

  return {
    id: loginResponse.userId,
    name: loginResponse.username,
    email: loginResponse.username,
    organization: subOrganization,
  }
}

type AuthActionType =
  | { type: "PASSKEY"; payload: UserSession }
  | { type: "INIT_EMAIL_AUTH" }
  | { type: "COMPLETE_EMAIL_AUTH"; payload: UserSession }
  | { type: "EMAIL_RECOVERY"; payload: UserSession }
  | { type: "WALLET_AUTH"; payload: UserSession }
  | { type: "OAUTH"; payload: UserSession }
  | { type: "LOADING"; payload: boolean }
  | { type: "ERROR"; payload: string }
  | { type: "SESSION_EXPIRING"; payload: boolean }

interface AuthState {
  loading: boolean
  error: string
  user: UserSession | null
  sessionExpiring: boolean
}

const initialState: AuthState = {
  loading: false,
  error: "",
  user: null,
  sessionExpiring: false,
}

function authReducer(state: AuthState, action: AuthActionType): AuthState {
  switch (action.type) {
    case "LOADING":
      return { ...state, loading: action.payload }
    case "ERROR":
      return { ...state, error: action.payload, loading: false }
    case "INIT_EMAIL_AUTH":
      return { ...state, loading: false, error: "" }
    case "COMPLETE_EMAIL_AUTH":
      return { ...state, user: action.payload, loading: false, error: "" }
    case "PASSKEY":
    case "EMAIL_RECOVERY":
    case "WALLET_AUTH":
    case "OAUTH":
      return { ...state, user: action.payload, loading: false, error: "" }
    case "SESSION_EXPIRING":
      return { ...state, sessionExpiring: action.payload }
    default:
      return state
  }
}

const AuthContext = createContext<{
  state: AuthState
  initEmailLogin: (email: Email) => Promise<void>
  completeEmailAuth: (params: {
    userEmail: string
    continueWith: string
    credentialBundle: string
  }) => Promise<void>
  loginWithPasskey: (email?: Email) => Promise<void>
  loginWithWallet: () => Promise<void>
  loginWithOAuth: (credential: string, providerName: string) => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  loginWithApple: (credential: string) => Promise<void>
  loginWithFacebook: (credential: string) => Promise<void>
  logout: () => Promise<void>
}>({
  state: initialState,
  initEmailLogin: async () => {},
  completeEmailAuth: async () => {},
  loginWithPasskey: async () => {},
  loginWithWallet: async () => {},
  loginWithOAuth: async () => {},
  loginWithGoogle: async () => {},
  loginWithApple: async () => {},
  loginWithFacebook: async () => {},
  logout: async () => {},
})

const SESSION_EXPIRY = "900" // This is in seconds
const WARNING_BUFFER = 30 // seconds before expiry to show warning

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const router = useRouter()
  const { turnkey, indexedDbClient, passkeyClient, walletClient } = useTurnkey()
  const warningTimeoutRef = useRef<NodeJS.Timeout>()

  const initEmailLogin = async (email: Email) => {
    dispatch({ type: "LOADING", payload: true })

    try {
      const publicKey = await indexedDbClient?.getPublicKey()
      if (!publicKey) {
        throw new Error("No public key found")
      }

      const targetPublicKey = toHex(
        uncompressRawPublicKey(new Uint8Array(Buffer.from(publicKey, "hex")))
      )

      if (!targetPublicKey) {
        throw new Error("No public key found")
      }

      const response = await initEmailAuth({
        email,
        targetPublicKey,
        baseUrl: window.location.origin,
      })

      if (response) {
        // Persist otpId locally so it can be reused after page reloads
        if (response.otpId) {
          setOtpIdInStorage(response.otpId)
        }
        dispatch({ type: "INIT_EMAIL_AUTH" })
        router.push(`/email-auth?userEmail=${encodeURIComponent(email)}`)
      }
    } catch (error: any) {
      dispatch({ type: "ERROR", payload: error.message })
    } finally {
      dispatch({ type: "LOADING", payload: false })
    }
  }

  const completeEmailAuth = async ({
    userEmail,
    continueWith,
    credentialBundle,
  }: {
    userEmail: string
    continueWith: string
    credentialBundle: string
  }) => {
    // validate inputs and begin auth flow

    if (userEmail && continueWith === "email" && credentialBundle) {
      dispatch({ type: "LOADING", payload: true })

      try {
        const publicKeyCompressed = await indexedDbClient?.getPublicKey()
        if (!publicKeyCompressed) {
          throw new Error("No public key found")
        }
        // We keep the compressed key form for downstream calls

        // Retrieve persisted otpId
        const storedOtpId = getOtpIdFromStorage()

        if (!storedOtpId) {
          throw new Error("OTP identifier not found. Please restart sign-in.")
        }
        const authResponse = await verifyOtp({
          otpId: storedOtpId,
          publicKey: publicKeyCompressed,
          otpCode: credentialBundle,
        })

        const { session, userId, organizationId } = await otpLogin({
          email: userEmail as Email,
          publicKey: publicKeyCompressed,
          verificationToken: authResponse.verificationToken,
        })

        await indexedDbClient?.loginWithSession(session || "")

        // Clear persisted otpId after successful login
        removeOtpIdFromStorage()

        // Schedule warning for session expiry
        const expiryTime = Date.now() + parseInt(SESSION_EXPIRY) * 1000
        scheduleSessionWarning(expiryTime)

        setSessionInStorage({
          id: userId,
          name: userEmail,
          email: userEmail,
          organization: {
            organizationId: organizationId,
            organizationName: "",
          },
        })

        router.push("/dashboard")
      } catch (error: any) {
        console.error("[completeEmailAuth] Error:", error)
        dispatch({ type: "ERROR", payload: error.message })
      } finally {
        dispatch({ type: "LOADING", payload: false })
      }
    }
  }

  const loginWithPasskey = async (email?: Email) => {
    dispatch({ type: "LOADING", payload: true })
    try {
      const subOrgId = await getSubOrgIdByEmail(email as Email)

      if (subOrgId?.length) {
        await indexedDbClient?.resetKeyPair()
        const publicKey = await indexedDbClient!.getPublicKey()
        await passkeyClient?.loginWithPasskey({
          sessionType: SessionType.READ_WRITE,
          publicKey,
        })

        router.push("/dashboard")
      } else {
        // User either does not have an account with a sub organization
        // or does not have a passkey
        // Create a new passkey for the user
        const { encodedChallenge, attestation } =
          (await passkeyClient?.createUserPasskey({
            publicKey: {
              user: {
                name: email,
                displayName: email,
              },
            },
          })) || {}

        // Create a new sub organization for the user
        if (encodedChallenge && attestation) {
          const { subOrg, user } = await createUserSubOrg({
            email: email as Email,
            passkey: {
              challenge: encodedChallenge,
              attestation,
            },
          })

          if (subOrg && user) {
            // Store session using browser localStorage
            setSessionInStorage(
              loginResponseToUser(
                {
                  userId: user.userId,
                  username: user.userName,
                  organizationId: subOrg.subOrganizationId,
                  organizationName: "",
                  session: undefined,
                  sessionExpiry: undefined,
                },
                AuthClient.Passkey
              )
            )

            router.push("/dashboard")
          }
        }
      }
    } catch (error: any) {
      dispatch({ type: "ERROR", payload: error.message })
    } finally {
      dispatch({ type: "LOADING", payload: false })
    }
  }

  const loginWithWallet = async () => {
    dispatch({ type: "LOADING", payload: true })

    try {
      await indexedDbClient?.resetKeyPair()
      const publicKey = await indexedDbClient?.getPublicKey()
      const walletPublicKey = await walletClient?.getPublicKey()

      if (!publicKey || !walletPublicKey) {
        throw new Error("No public key found")
      }

      // Try and get the suborg id given the user's wallet public key
      let subOrgId = await getSubOrgIdByPublicKey(walletPublicKey)
      let user = null
      // If the user has a suborg id, use the oauth flow to login
      if (!subOrgId) {
        // If the user does not have a suborg id, create a new suborg for the user
        const { subOrg, user: newUser } = await createUserSubOrg({
          wallet: {
            publicKey: walletPublicKey,
            type: WalletType.Ethereum,
          },
        })
        subOrgId = subOrg.subOrganizationId
        user = newUser
      }

      await walletClient?.loginWithWallet({
        publicKey,
        sessionType: SessionType.READ_WRITE,
      })

      router.push("/dashboard")
    } catch (error: any) {
      dispatch({ type: "ERROR", payload: error.message })
    } finally {
      dispatch({ type: "LOADING", payload: false })
    }
  }

  const loginWithOAuth = async (credential: string, providerName: string) => {
    dispatch({ type: "LOADING", payload: true })
    try {
      const publicKeyCompressed = await indexedDbClient?.getPublicKey()

      if (!publicKeyCompressed) {
        throw new Error("No public key found")
      }

      const publicKey = toHex(
        uncompressRawPublicKey(
          new Uint8Array(Buffer.from(publicKeyCompressed, "hex"))
        )
      ).replace("0x", "")

      // Determine if the user has a sub-organization associated with their email
      let subOrgId = await getSubOrgId({ oidcToken: credential })

      if (!subOrgId) {
        // User does not have a sub-organization associated with their email
        // Create a new sub-organization for the user
        const { subOrg } = await createUserSubOrg({
          oauth: {
            oidcToken: credential,
            providerName,
          },
        })
        subOrgId = subOrg.subOrganizationId
      }

      // Note: You need to use the compressed public key here because when the
      // indexedDbClient stamps the request and the key is compared in the backend it expects the compressed version
      const oauthResponse = await oauth({
        credential,
        publicKey: publicKeyCompressed,
        subOrgId,
      })

      await indexedDbClient?.loginWithSession(oauthResponse.session)

      router.push("/dashboard")
    } catch (error: any) {
      dispatch({ type: "ERROR", payload: error.message })
    } finally {
      dispatch({ type: "LOADING", payload: false })
    }
  }

  const loginWithGoogle = async (credential: string) => {
    await loginWithOAuth(credential, "Google Auth - Embedded Wallet")
  }

  const loginWithApple = async (credential: string) => {
    await loginWithOAuth(credential, "Apple Auth - Embedded Wallet")
  }

  const loginWithFacebook = async (credential: string) => {
    await loginWithOAuth(credential, "Facebook Auth - Embedded Wallet")
  }

  const logout = async () => {
    await turnkey?.logout()
    await indexedDbClient?.clear()
    googleLogout()
    router.push("/")
  }

  const scheduleSessionWarning = (expiryTime: number) => {
    // Clear any existing timeout
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }

    const warningTime = expiryTime - WARNING_BUFFER * 1000
    const now = Date.now()
    const timeUntilWarning = warningTime - now

    if (timeUntilWarning > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        dispatch({ type: "SESSION_EXPIRING", payload: true })

        // Reset the warning after session actually expires
        const resetTimeout = setTimeout(() => {
          dispatch({ type: "SESSION_EXPIRING", payload: false })
        }, WARNING_BUFFER * 1000)

        // Clean up reset timeout on unmount
        return () => clearTimeout(resetTimeout)
      }, timeUntilWarning)
    }
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current)
      }
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        state,
        initEmailLogin,
        completeEmailAuth,
        loginWithPasskey,
        loginWithWallet,
        loginWithOAuth,
        loginWithGoogle,
        loginWithApple,
        loginWithFacebook,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
