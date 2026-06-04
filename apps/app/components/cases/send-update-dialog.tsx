"use client"

import * as React from "react"
import { Send } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Label } from "@workspace/ui/components/label"
import { toast } from "@workspace/ui/components/sonner"
import { Textarea } from "@workspace/ui/components/textarea"

import { Field } from "@/components/form-field"

export function SendUpdateDialog({ clientName }: { clientName: string }) {
  const [open, setOpen] = React.useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOpen(false)
    toast.success("Monthly update sent", { description: "Delivered via SMS and the client portal." })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Send className="size-4" /> Send update
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Send monthly update</DialogTitle>
            <DialogDescription>Confirm the case status update for {clientName}.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-5">
            <Field label="Message">
              <Textarea
                rows={4}
                defaultValue={`Hi ${clientName}, here is your monthly case update. Your petition remains pending with USCIS and is within normal processing times. We'll notify you as soon as there's an update.`}
              />
            </Field>
            <Field label="Channels">
              <div className="flex flex-wrap gap-4">
                {["Client portal", "SMS"].map((ch, i) => (
                  <div key={ch} className="flex items-center gap-2">
                    <Checkbox id={`ch-${i}`} defaultChecked />
                    <Label htmlFor={`ch-${i}`} className="text-sm font-normal">
                      {ch}
                    </Label>
                  </div>
                ))}
              </div>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Send update</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
