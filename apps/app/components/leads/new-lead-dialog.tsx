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
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"

import { Field } from "@/components/form-field"
import { CASE_TYPES, STAFF } from "@/data"
import { useStore } from "@/data/store"
import type { CaseType, LeadSource } from "@/data/types"

const SOURCES: LeadSource[] = ["WhatsApp", "Facebook", "Instagram", "Call Rails", "Website", "Referral"]
const SALES = STAFF.filter((u) => u.role === "sales")
const DEFAULT_ASSIGNEE = SALES[0]?.id ?? "u8"

export function NewLeadDialog() {
  const { addLead } = useStore()
  const [open, setOpen] = React.useState(false)
  const [source, setSource] = React.useState<string>("Website")
  const [caseType, setCaseType] = React.useState<string>("none")
  const [assignee, setAssignee] = React.useState<string>(DEFAULT_ASSIGNEE)

  function reset() {
    setSource("Website")
    setCaseType("none")
    setAssignee(DEFAULT_ASSIGNEE)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const get = (k: string) => String(fd.get(k) ?? "").trim()

    addLead({
      firstName: get("firstName"),
      lastName: get("lastName"),
      phone: get("phone"),
      email: get("email"),
      city: get("city"),
      state: get("state"),
      countryOfOrigin: get("countryOfOrigin"),
      preferredLanguage: get("preferredLanguage") || "English",
      source: source as LeadSource,
      caseType: caseType === "none" ? undefined : (caseType as CaseType),
      assignedToId: assignee,
    })

    toast.success("Lead created", {
      description: `${get("firstName")} ${get("lastName")} added to the pipeline.`,
    })
    form.reset()
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> New lead
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
            <DialogDescription>Capture a new lead into the CRM pipeline.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field label="First name">
              <Input name="firstName" required placeholder="Maria" />
            </Field>
            <Field label="Last name">
              <Input name="lastName" required placeholder="Gonzalez" />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" placeholder="(305) 555-0142" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" required placeholder="maria@email.com" />
            </Field>
            <Field label="Source">
              <Select
                value={source}
                onValueChange={(v) => setSource(v ?? "Website")}
                items={SOURCES.map((s) => ({ value: s, label: s }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Case type">
              <Select
                value={caseType}
                onValueChange={(v) => setCaseType(v ?? "none")}
                items={[{ value: "none", label: "Not set" }, ...CASE_TYPES.map((t) => ({ value: t, label: t }))]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Case type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {CASE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preferred language">
              <Input name="preferredLanguage" placeholder="Spanish" />
            </Field>
            <Field label="Country of origin">
              <Input name="countryOfOrigin" placeholder="Mexico" />
            </Field>
            <Field label="City">
              <Input name="city" placeholder="Miami" />
            </Field>
            <Field label="State">
              <Input name="state" placeholder="FL" />
            </Field>
            <Field label="Assign to" className="sm:col-span-2">
              <Select
                value={assignee}
                onValueChange={(v) => setAssignee(v ?? DEFAULT_ASSIGNEE)}
                items={SALES.map((u) => ({ value: u.id, label: u.name }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  {SALES.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Create lead</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
