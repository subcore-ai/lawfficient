"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { toast } from "@workspace/ui/components/sonner"

import { updateLead } from "@/app/(app)/leads/actions"
import { LeadFormFields } from "@/components/leads/lead-form-fields"
import type { AssigneeOption, LeadView } from "@/lib/leads/queries"

// Controlled (no trigger) — callers (row actions, detail header) own the open state.
export function EditLeadDialog({
  lead,
  assignees,
  open,
  onOpenChange,
}: {
  lead: LeadView
  assignees: AssigneeOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = React.useTransition()
  // Remount the fields on each open (like NewLeadDialog) so Cancel discards unsaved edits and
  // reopening reflects the latest server values — Base UI keeps the closed subtree mounted.
  // Adjust state during render on the open transition (React's documented pattern) rather than
  // in an effect, since the parent opens this controlled dialog programmatically.
  const [seq, setSeq] = React.useState(0)
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSeq((s) => s + 1)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateLead(lead.id, fd)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Lead updated")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit lead</DialogTitle>
            <DialogDescription>
              {lead.firstName} {lead.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-1 py-5">
            <LeadFormFields key={seq} lead={lead} assignees={assignees} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
