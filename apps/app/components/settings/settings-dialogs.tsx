"use client"

import * as React from "react"
import { Copy, UserPlus } from "lucide-react"

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
import type { Role, StaffUser } from "@/data/types"
import {
  getInviteLink,
  inviteUser,
  resendInvite,
  revokeInvite,
  setUserStatus,
  updateUserProfile,
} from "@/app/(app)/settings/users/actions"

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
  const [open, setOpen] = React.useState(false)
  const [role, setRole] = React.useState<Role>("legal_assistant")
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("role", role)
    startTransition(async () => {
      const res = await inviteUser(fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Invite sent", { description: "An invitation email is on its way." })
      setRole("legal_assistant")
      setOpen(false)
    })
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
              <Input name="email" type="email" required placeholder="jordan@chidoluelaw.com" />
            </Field>
            <Field label="Role">
              <RoleSelect value={role} onChange={setRole} />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ManageUserDialog({ user }: { user: StaffUser }) {
  const [open, setOpen] = React.useState(false)
  const [role, setRole] = React.useState<Role>(user.role)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("role", role)
    startTransition(async () => {
      const res = await updateUserProfile(user.id, fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("User updated", { description: `${user.name}'s profile was saved.` })
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Manage</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Manage user</DialogTitle>
            <DialogDescription>Update the display name and role.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="Full name">
              <Input name="name" defaultValue={user.name} required />
            </Field>
            <Field label="Email">
              {/* Email changes are admin-only + re-verified — handled separately, not here. */}
              <Input defaultValue={user.email} disabled />
            </Field>
            <Field label="Role">
              <RoleSelect value={role} onChange={setRole} />
            </Field>
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

// Status-aware per-row controls: pending invites can be resent/revoked; active
// users managed/disabled; disabled users re-enabled. Mutations run through the
// server actions (admin-gated + audited); revalidatePath refreshes the table.
export function UserRowActions({
  user,
  currentUserId,
}: {
  user: StaffUser
  currentUserId: string
}) {
  const [pending, startTransition] = React.useTransition()

  function run(action: () => Promise<{ ok: true } | { error: string }>, success: string) {
    startTransition(async () => {
      const res = await action()
      if ("error" in res) toast.error(res.error)
      else toast.success(success)
    })
  }

  // Copy the activation link (not a resend) so the admin can share it directly.
  function copyInviteLink() {
    startTransition(async () => {
      const res = await getInviteLink(user.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      try {
        await navigator.clipboard.writeText(res.url)
        toast.success("Invite link copied", { description: "Share it with the new user directly." })
      } catch {
        toast.error("Couldn't access the clipboard", { description: res.url })
      }
    })
  }

  if (user.status === "invited") {
    return (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={copyInviteLink}
          title="Copy invite link"
          aria-label="Copy invite link"
        >
          <Copy className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => resendInvite(user.id), "Invite resent")}
        >
          Resend
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => revokeInvite(user.id), "Invite revoked")}
        >
          Revoke
        </Button>
      </div>
    )
  }

  if (user.status === "disabled") {
    return (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => setUserStatus(user.id, "active"), "User enabled")}
        >
          Enable
        </Button>
        <ManageUserDialog user={user} />
      </div>
    )
  }

  return (
    <div className="flex justify-end gap-1">
      <ManageUserDialog user={user} />
      {user.id !== currentUserId ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => setUserStatus(user.id, "disabled"), "User disabled")}
        >
          Disable
        </Button>
      ) : null}
    </div>
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
