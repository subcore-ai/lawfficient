"use client"

import * as React from "react"
import { UserPlus } from "lucide-react"

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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"

import { Field } from "@/components/form-field"
import { useStore } from "@/data/store"
import type { Lead } from "@/data/types"

const PLANS = ["Full payment", "Monthly plan", "Down payment + monthly"]

export function ConvertLeadDialog({ lead }: { lead: Lead }) {
  const { convertLead } = useStore()
  const [open, setOpen] = React.useState(false)
  const [plan, setPlan] = React.useState(PLANS[1])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    convertLead(lead.id)
    setOpen(false)
    toast.success("Converted to retained client", {
      description: "Invoice created and portal access provisioned.",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus className="size-4" /> Convert to client
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Convert to retained client</DialogTitle>
            <DialogDescription>
              Set up the retainer for {lead.firstName} {lead.lastName}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field label="Total legal fees">
              <Input type="number" min={0} step={100} defaultValue={7500} />
            </Field>
            <Field label="Down payment">
              <Input type="number" min={0} step={100} defaultValue={2500} />
            </Field>
            <Field label="Payment plan" className="sm:col-span-2">
              <Select
                value={plan}
                onValueChange={(v) => setPlan(v ?? PLANS[1])}
                items={PLANS.map((p) => ({ value: p, label: p }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox id="filing-fees" />
              <Label htmlFor="filing-fees" className="text-sm font-normal">
                Include USCIS filing fees in the plan
              </Label>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Convert client</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
