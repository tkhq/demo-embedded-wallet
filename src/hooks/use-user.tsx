import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { TurnkeyBrowserClient } from "@turnkey/sdk-browser"
import { useTurnkey } from "@turnkey/sdk-react"

import { Email, User } from "@/types/turnkey"

export const useUser = () => {
  const { turnkey, getActiveClient } = useTurnkey()
  const router = useRouter()
  const [user, setUser] = useState<User | undefined>(undefined)

  useEffect(() => {
    const fetchUser = async () => {
      if (turnkey) {
        // Try and get the current user
        const currentUser = await turnkey.getCurrentUser()
        console.log("currentUser", currentUser)
        // If the user is not found, we assume the user is not logged in
        if (!currentUser) {
          router.push("/")
          return
        }

        let client: TurnkeyBrowserClient | undefined
        // First, check if the user has a read-write session
        const readWriteSession = await turnkey.getReadWriteSession()

        if (readWriteSession) {
          // If the user has a read-write session, we'll use getActiveClient to get the Turnkey IFrame client
          // initialized with the read-write session
          client = await getActiveClient()
        } else {
          // If the user does not have a read-write session, we'll use the currentUserSession method to get the Turnkey IFrame client
          // initialized with the current user's session
          client = await turnkey.currentUserSession()
        }

        let userData: User = currentUser

        // Get the user's email
        const { user } =
          (await client?.getUser({
            organizationId: currentUser?.organization?.organizationId,
            userId: currentUser?.userId,
          })) || {}
        console.log("user", user)
        // Set the user's email in the userData object
        userData = { ...currentUser, email: user?.userEmail as Email }
        setUser(userData)
      }
    }
    fetchUser()
  }, [turnkey])

  const logout = async () => {
    if (turnkey) {
      await turnkey.logoutUser()
      setUser(undefined)
      router.push("/")
    }
  }

  return { user, logout }
}
