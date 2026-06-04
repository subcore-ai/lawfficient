import type * as React from "react"

import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"

export function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label?: string
  htmlFor?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
    </div>
  )
}
