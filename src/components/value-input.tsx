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

// Maximum number of digits allowed after the decimal point while typing
const MAX_DECIMALS = 10

// Sanitizes arbitrary user input into a valid decimal string.
// - Strict dot-only (commas removed)
// - Keeps at most one dot
// - Normalizes leading zeros
// - Allows a trailing dot as an intermediate state ("1.")
function sanitizeDecimalInput(raw: string): string {
  // Remove commas (strict dot-only) and any non-digit/non-dot characters
  let s = raw.replace(/,/g, "").replace(/[^0-9.]/g, "")

  if (s === "") return ""

  const hadTrailingDot = s.endsWith(".")

  // Keep only the first dot
  const firstDotIndex = s.indexOf(".")
  if (firstDotIndex !== -1) {
    s =
      s.slice(0, firstDotIndex + 1) +
      s.slice(firstDotIndex + 1).replace(/\./g, "")
  }

  const hasDot = s.includes(".")

  const normalizeInteger = (intPart: string) => {
    const withoutLeading = intPart.replace(/^0+(?=\d)/, "")
    return withoutLeading === "" ? "0" : withoutLeading
  }

  if (!hasDot) {
    const intPart = normalizeInteger(s)
    return intPart
  }

  let [intPart, fracPart = ""] = s.split(".")

  // If started with dot, ensure integer becomes 0
  if (intPart === "") intPart = "0"
  intPart = normalizeInteger(intPart)

  // Enforce max decimals
  if (fracPart.length > MAX_DECIMALS) {
    fracPart = fracPart.slice(0, MAX_DECIMALS)
  }

  // Allow a trailing dot during typing
  if (hadTrailingDot && fracPart.length === 0) {
    return `${intPart}.`
  }

  return fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart
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
    const sanitized = sanitizeDecimalInput(e.target.value)
    onValueChange?.(sanitized)
  }

  const handleBlur = () => {
    if (!onValueChange) return
    if (!value) return
    if (value === ".") {
      onValueChange("0")
      return
    }
    if (value.endsWith(".")) {
      onValueChange(value.slice(0, -1))
    }
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
        onBlur={handleBlur}
        placeholder={placeholder}
        className="placeholder-muted bg-transparent font-semibold focus:outline-hidden"
        style={{ width: `${inputWidth}px` }}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={label || "Value"}
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
