import React from "react"

import { Input } from "@/components/ui/input"

interface RecipientAddressInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const RecipientAddressInput: React.FC<RecipientAddressInputProps> = ({
  value,
  onChange,
  placeholder = "Enter recipient address",
}) => {
  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      autoComplete="off"
      className="grow border-none bg-transparent px-2 font-mono text-xs placeholder-[#8e8e93] focus-visible:ring-0 focus-visible:ring-offset-0 sm:px-3 sm:py-2 sm:text-sm"
    />
  )
}

export { RecipientAddressInput }
