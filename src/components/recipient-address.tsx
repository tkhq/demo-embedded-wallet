import React, { useState } from "react"

import { Input } from "@/components/ui/input"

interface RecipientAddressInputProps {
  initialAddress: string
}

const RecipientAddressInput: React.FC<RecipientAddressInputProps> = ({
  initialAddress,
}) => {
  return (
    <Input
      placeholder="Enter recipient address"
      value={initialAddress}
      disabled
      className="flex-grow border-none bg-transparent px-2 text-xs placeholder-[#8e8e93] focus-visible:ring-0 focus-visible:ring-offset-0 sm:px-3 sm:py-2 sm:text-sm"
    />
  )
}

export { RecipientAddressInput }
