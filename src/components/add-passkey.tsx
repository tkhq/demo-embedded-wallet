import { useState } from "react"
import { useTurnkey } from "@turnkey/sdk-react"
import { toast } from "sonner"

import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export default function AddPasskey({
  onPasskeyAdded,
}: {
  onPasskeyAdded: (authenticatorId: string) => void
}) {
  const { passkeyClient, turnkey, getActiveClient } = useTurnkey()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [passkeyName, setPasskeyName] = useState("")

  const handleAddPasskey = async () => {
    if (!user) {
      return
    }

    const activeClient = await getActiveClient()

    const credential = await passkeyClient?.createUserPasskey({
      publicKey: {
        rp: {
          name: "Turnkey - Demo Embedded Wallet",
        },
        user: {
          name: user?.username,
          displayName: user?.username,
        },
      },
    })

    if (credential) {
      const authenticatorsResponse = await activeClient?.createAuthenticators({
        authenticators: [
          {
            authenticatorName: passkeyName,
            challenge: credential.encodedChallenge,
            attestation: credential.attestation,
          },
        ],
        userId: `${user?.userId}`,
      })

      if (authenticatorsResponse?.activity.id) {
        toast.success("Passkey added!")
        onPasskeyAdded(authenticatorsResponse.authenticatorIds[0])
      }
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="text-xs sm:text-sm" variant="outline" size="sm">
          Add Passkey
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-left">Add Passkey</DialogTitle>
          <DialogDescription className="text-left">
            Help identify your passkey by giving it a unique name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label
              htmlFor="passkey-name"
              className="text-left text-sm font-medium"
            >
              Passkey name
            </label>
            <Input
              id="passkey-name"
              placeholder="Type a name"
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddPasskey} disabled={!passkeyName}>
            Add Passkey
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
