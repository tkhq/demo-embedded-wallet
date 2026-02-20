"use client"

import React, { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface ValueInputProps {
  value: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  label?: string
}

function scaleFactor(width: number) {
  return 1.1875 - 0.00307 * width + 3.7e-6 * width ** 2 - 1.62e-9 * width ** 3
}

export const ValueInput: React.FC<ValueInputProps> = ({
  value,
  onValueChange,
  placeholder = "0",
  className = "",
  label = "",
}) => {
  const [inputWidth, setInputWidth] = useState(20)
  const [fontSize, setFontSize] = useState(1)
  const spanRef = useRef<HTMLSpanElement>(null)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const newValue = e.target.value.replace(/[^0-9.]/g, "")

    // Allow '0' after the first character
    let finalValue = newValue
    if (newValue.length > 1 && newValue[0] === "0" && newValue[1] !== ".") {
      finalValue = newValue.slice(1)
    }

    onValueChange?.(finalValue)
  }

  useEffect(() => {
    if (spanRef.current) {
      const newWidth = Math.max(spanRef.current.offsetWidth + 4, 20) // 4px buffer, minimum 20px

      setInputWidth(newWidth)
      const scale = scaleFactor(newWidth)
      setFontSize(scale)
    }
  }, [value])

  return (
    <div
      className={cn(
        className,
        `relative inline-flex max-w-64 origin-left items-center`
      )}
      style={{ transform: `scale(${fontSize})` }} // Apply scale to the container div
    >
      <input
        autoFocus
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="placeholder-muted bg-transparent font-semibold focus:outline-hidden"
        style={{ width: `${inputWidth}px` }}
      />
      <span className="ml-1 text-gray-400">{label}</span>
      <span
        ref={spanRef}
        className="invisible absolute left-0 font-semibold whitespace-pre"
        aria-hidden="true"
      >
        {value || placeholder}
      </span>
    </div>
  )
}
