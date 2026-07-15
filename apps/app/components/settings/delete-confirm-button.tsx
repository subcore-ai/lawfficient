"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { toast } from "@workspace/ui/components/sonner"

import type { ActionResult } from "@/lib/actions/result"

// The trash-icon trigger + confirm dialog every Settings list row uses to delete one item. The
// dialog stays open on failure so the toasted error is readable next to what it refers to.
export function DeleteConfirmButton({
  entityLabel,
  title,
  titleClassName,
  description,
  confirmLabel = "Delete",
  successMessage,
  action,
}: {
  /** Names the item in the trigger's aria-label, e.g. "Delete {entityLabel}". */
  entityLabel: string
  title: React.ReactNode
  titleClassName?: string
  description: React.ReactNode
  confirmLabel?: string
  successMessage: string
  action: () => Promise<ActionResult>
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function onDelete() {
    startTransition(async () => {
      try {
        const res = await action()
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success(successMessage)
        setOpen(false)
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Delete ${entityLabel}`} />}>
        <Trash2 className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
