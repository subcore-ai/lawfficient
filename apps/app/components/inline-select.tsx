"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

/** A borderless select for quick inline edits (status, assignee) in tables and headers. */
export function InlineSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
  disabled = false,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  ariaLabel: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v ?? value)} disabled={disabled} items={options}>
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className={cn(
          "hover:bg-muted h-7 w-auto gap-1 border-transparent bg-transparent px-2 dark:bg-transparent dark:hover:bg-muted/50",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
