import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTurnkey } from "@turnkey/sdk-react"

import { UserSession } from "@/types/turnkey"

export const useUser = () => {
  const { turnkey, indexedDbClient } = useTurnkey()
  const router = useRouter()
  const [user, setUser] = useState<UserSession | undefined>(undefined)

  useEffect(() => {
    const fetchUser = async () => {
      if (turnkey) {
        // Try and get the current user

        const token = await turnkey.getSession()

        // If the user is not found, we assume the user is not logged in
        if (!token?.expiry || token.expiry > Date.now()) {
          router.push("/")
          return
        }

        // Get the user's email
        const { user } =
          (await indexedDbClient?.getUser({
            organizationId: token.organizationId,
            userId: token.userId,
          })) || {}

        // Set the user's email in the userData object
        setUser({
          id: user?.userId || "",
          name: user?.userName || "",
          email: user?.userEmail || "",
          organization: {
            organizationId: token.organizationId,
            organizationName: "",
          },
        })
      }
    }
    fetchUser()
  }, [turnkey, indexedDbClient])

  return { user }
}
