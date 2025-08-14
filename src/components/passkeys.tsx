"use client"

import { useEffect, useState } from "react"
import { useTurnkey } from "@turnkey/react-wallet-kit"

import { Authenticator } from "@/types/turnkey"
import { Skeleton } from "@/components/ui/skeleton"

import AddPasskey from "./add-passkey"
import { PasskeyItem } from "./passkey-item"

export function Passkeys() {
  const { httpClient, user, session } = useTurnkey()
  const [authenticators, setAuthenticators] = useState<Authenticator[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (user) {
      setLoading(true)
      httpClient
        ?.getAuthenticators({
          userId: user.userId,
          organizationId: session?.organizationId ?? "",
        })
        .then(({ authenticators }) => {
          setAuthenticators(authenticators)
          setLoading(false)
        })
    }
  }, [user, session, httpClient])

  const removeAuthenticator = async (authenticatorId: string) => {
    const authenticatorResponse = await httpClient?.deleteAuthenticators({
      userId: `${user?.userId}`,
      authenticatorIds: [authenticatorId],
    })
    if (authenticatorResponse) {
      const nextAuthenticators = authenticators.filter(
        (authenticator) => authenticator.authenticatorId !== authenticatorId
      )
      setAuthenticators(nextAuthenticators)
    }
  }

  const onPasskeyAdded = async (authenticatorId: string) => {
    if (!session?.organizationId) return

    const { authenticator } =
      (await httpClient?.getAuthenticator({
        authenticatorId: authenticatorId,
        organizationId: session?.organizationId ?? "",
      })) || {}
    if (authenticator) {
      setAuthenticators((prev) => [...prev, authenticator as Authenticator])
    }
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-4">
        <h3 className="font-semibold sm:text-lg">Passkeys</h3>
        <AddPasskey onPasskeyAdded={onPasskeyAdded} />
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-[74px] w-full animate-pulse" />
        ) : (
          <div className="space-y-4">
            {authenticators.map((authenticator) => (
              <PasskeyItem
                key={authenticator.authenticatorId}
                name={authenticator.authenticatorName}
                createdAt={
                  new Date(parseInt(authenticator.createdAt.seconds) * 1000)
                }
                onRemove={() =>
                  removeAuthenticator(authenticator.authenticatorId)
                }
                isRemovable={authenticators.length > 1} // Set isRemovable based on the number of authenticators
              />
            ))}
          </div>
        )}
        {!loading && authenticators.length === 0 && (
          <p className="text-muted-foreground py-4 text-center">
            No passkeys added yet.
          </p>
        )}
      </div>
    </div>
  )
}
