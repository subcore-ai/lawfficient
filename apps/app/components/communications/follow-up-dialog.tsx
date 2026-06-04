"use client"

import * as React from "react"

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

const CHANNELS = ["Client portal message", "Text message", "Phone call"]

export function FollowUpDialog() {
  const [open, setOpen] = React.useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOpen(false)
    toast.success("Follow-up started", {
      description: "Portal message and text queued; a callback task was created.",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="w-fit" />}>Start follow-up</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Three-pronged follow-up</DialogTitle>
            <DialogDescription>
              Reach the client through all three channels with one shared summary.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="Conversation summary">
              <Textarea
                rows={3}
                defaultValue="Following up on the outstanding documents for your packet. Please upload your passport bio page and marriage certificate by Friday."
              />
            </Field>
            <Field label="Send via">
              <div className="flex flex-col gap-2">
                {CHANNELS.map((ch, i) => (
                  <div key={ch} className="flex items-center gap-2">
                    <Checkbox id={`fu-${i}`} defaultChecked />
                    <Label htmlFor={`fu-${i}`} className="text-sm font-normal">
                      {ch}
                    </Label>
                  </div>
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Start follow-up</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
