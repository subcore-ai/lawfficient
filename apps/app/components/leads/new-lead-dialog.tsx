"use client"

import * as React from "react"
import { Plus } from "lucide-react"

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

import { createLead } from "@/app/(app)/leads/actions"
import { LeadFormFields } from "@/components/leads/lead-form-fields"
import type { AssigneeOption } from "@/lib/leads/queries"

export function NewLeadDialog({ assignees }: { assignees: AssigneeOption[] }) {
  const [open, setOpen] = React.useState(false)
  const [seq, setSeq] = React.useState(0) // bump on open to remount the form fresh
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createLead(fd)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Lead created")
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setSeq((s) => s + 1)
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> New lead
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form key={seq} onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
            <DialogDescription>Capture a new lead into the pipeline.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-1 py-5">
            <LeadFormFields assignees={assignees} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
