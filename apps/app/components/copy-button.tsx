"use client"

import { Copy } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

// Copy a value to the clipboard with a toast. Shared by the Settings editors (API keys, webhooks,
// lead sources) that reveal a one-time secret next to a copy affordance.
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        // navigator.clipboard is undefined in non-secure contexts / older browsers — guard it.
        if (!navigator.clipboard) {
          toast.error("Copying isn't available here — select the text and copy manually.")
          return
        }
        navigator.clipboard.writeText(value).then(
          () => toast.success("Copied"),
          () => toast.error("Couldn't copy"),
        )
      }}
    >
      <Copy className="size-3.5" /> {label}
    </Button>
  )
}
