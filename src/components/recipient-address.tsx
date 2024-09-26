import React, { useState } from "react"

import { Input } from "@/components/ui/input"

interface RecipientAddressInputProps {
  initialAddress: string
  onAddressChange: (address: string) => void
}

const RecipientAddressInput: React.FC<RecipientAddressInputProps> = ({
  initialAddress,
  onAddressChange,
}) => {
  const [recipientAddress, setRecipientAddress] = useState(initialAddress)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value
    setRecipientAddress(newAddress)
  }

  const handleBlur = () => {
    onAddressChange(recipientAddress)
  }

  return (
    <Input
      placeholder="Enter recipient address"
      value={recipientAddress}
      onChange={handleChange}
      onBlur={handleBlur}
      className="flex-grow border-none bg-transparent px-2 text-xs placeholder-[#8e8e93] focus-visible:ring-0 focus-visible:ring-offset-0 sm:px-3 sm:py-2 sm:text-sm"
    />
  )
}

export { RecipientAddressInput }
