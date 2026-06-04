"use client"

import type * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

type ButtonProps = React.ComponentProps<typeof Button>

/**
 * A button that fires a success toast — used for scaffold actions that aren't
 * wired to a backend yet (send quote letter, convert lead, process payment, …).
 */
export function ToastButton({
  message,
  description,
  children,
  ...props
}: ButtonProps & { message: string; description?: string }) {
  return (
    <Button {...props} onClick={() => toast.success(message, description ? { description } : undefined)}>
      {children}
    </Button>
  )
}
