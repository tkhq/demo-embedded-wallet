import { useState } from "react"
import { useTurnkey } from "@turnkey/react-wallet-kit"
import { toast } from "sonner"

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
  const { user, handleAddPasskey } = useTurnkey()

  const [open, setOpen] = useState(false)
  const [passkeyName, setPasskeyName] = useState("")

  const _handleAddPasskey = async () => {
    if (!user) {
      return
    }

    const [authenticatorId] = await handleAddPasskey({
      name: passkeyName,
      displayName: passkeyName,
      userId: user?.userId,
    })

    if (authenticatorId) {
      toast.success("Passkey added!")
      onPasskeyAdded(authenticatorId)
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
          <Button onClick={_handleAddPasskey} disabled={!passkeyName}>
            Add Passkey
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
