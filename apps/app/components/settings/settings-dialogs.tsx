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
import { ROLE_LABELS } from "@/data"
import { useStore } from "@/data/store"
import type { Role, StaffUser } from "@/data/types"

const ROLES = Object.keys(ROLE_LABELS) as Role[]
const MODULES = ["Dashboard", "Leads", "Consultations", "Cases", "Documents", "Billing", "Reporting", "Admin"]

function RoleSelect({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange((v ?? "legal_assistant") as Role)}
      items={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Role" />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function InviteUserDialog() {
  const { addStaff } = useStore()
  const [open, setOpen] = React.useState(false)
  const [role, setRole] = React.useState<Role>("legal_assistant")

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = String(fd.get("name") ?? "").trim()
    const email = String(fd.get("email") ?? "").trim()
    addStaff({ name, email, role })
    toast.success("Invite sent", { description: `${name} invited as ${ROLE_LABELS[role]}.` })
    form.reset()
    setRole("legal_assistant")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus className="size-4" /> Invite user
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>Send an invitation email with a role.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="Full name">
              <Input name="name" required placeholder="Jordan Lee" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" required placeholder="jordan@chidolulaw.com" />
            </Field>
            <Field label="Role">
              <RoleSelect value={role} onChange={setRole} />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Send invite</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditUserDialog({ user }: { user: StaffUser }) {
  const { updateStaff } = useStore()
  const [open, setOpen] = React.useState(false)
  const [role, setRole] = React.useState<Role>(user.role)
  const [status, setStatus] = React.useState<StaffUser["status"]>(user.status)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    updateStaff(user.id, {
      name: String(fd.get("name") ?? "").trim() || user.name,
      email: String(fd.get("email") ?? "").trim() || user.email,
      role,
      status,
    })
    toast.success("User updated", { description: `${user.name}'s profile was saved.` })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Manage</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Manage user</DialogTitle>
            <DialogDescription>Update profile, role, and status.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field label="Full name" className="sm:col-span-2">
              <Input name="name" defaultValue={user.name} />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input name="email" type="email" defaultValue={user.email} />
            </Field>
            <Field label="Role">
              <RoleSelect value={role} onChange={setRole} />
            </Field>
            <Field label="Status">
              <Select
                value={status}
                onValueChange={(v) => setStatus((v ?? "active") as StaffUser["status"])}
                items={[
                  { value: "active", label: "Active" },
                  { value: "invited", label: "Invited" },
                  { value: "disabled", label: "Disabled" },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditRoleDialog({ role }: { role: Role }) {
  const [open, setOpen] = React.useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOpen(false)
    toast.success("Permissions updated", { description: `${ROLE_LABELS[role]} access saved.` })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Edit</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{ROLE_LABELS[role]} permissions</DialogTitle>
            <DialogDescription>Choose which modules this role can access.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-5">
            {MODULES.map((m, i) => (
              <div key={m} className="flex items-center gap-2">
                <Checkbox id={`perm-${role}-${i}`} defaultChecked={m !== "Admin" || role === "admin"} />
                <Label htmlFor={`perm-${role}-${i}`} className="text-sm font-normal">
                  {m}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Save permissions</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ManageTemplateDialog({ name }: { name: string }) {
  const [open, setOpen] = React.useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOpen(false)
    toast.success("Template updated", { description: `${name} saved and available to the team.` })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Manage</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>Upload a new version or rename this template.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="Template name">
              <Input defaultValue={name} />
            </Field>
            <div className="border-input text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
              Drag &amp; drop a PDF here, or click to browse
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Save template</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ConfigureIntegrationDialog({ name }: { name: string }) {
  const [open, setOpen] = React.useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOpen(false)
    toast.success(`${name} configured`, { description: "Connection settings saved." })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="w-fit" />}>
        Configure
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Configure {name}</DialogTitle>
            <DialogDescription>Manage the connection for {name}.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="API key">
              <Input type="password" defaultValue="sk_live_•••••••••••••••" />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox id={`enabled-${name}`} defaultChecked />
              <Label htmlFor={`enabled-${name}`} className="text-sm font-normal">
                Enabled
              </Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
