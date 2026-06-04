"use client"

import { Checkbox } from "@workspace/ui/components/checkbox"

export function ShowArchivedToggle({
  checked,
  onChange,
  count,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  count: number
}) {
  if (count === 0 && !checked) return null
  return (
    <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      Show archived{count ? ` (${count})` : ""}
    </label>
  )
}
