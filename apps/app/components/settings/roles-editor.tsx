"use client"

import * as React from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

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
import { toast } from "@workspace/ui/components/sonner"

import { Field } from "@/components/form-field"
import { PERMISSION_GROUPS, type AppPermission } from "@/lib/rbac/permissions"
import {
  createRole,
  deleteRole,
  renameRole,
  setRolePermissions,
} from "@/app/(app)/settings/roles/actions"

export type RoleRow = {
  id: string
  key: string
  name: string
  isSystem: boolean
  permissions: AppPermission[]
}

export function CreateRoleDialog() {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createRole(fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Role created", { description: "Set its permissions to finish." })
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> New role
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New role</DialogTitle>
            <DialogDescription>
              Create a custom role for your firm, then set its permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <Field label="Role name">
              <Input name="name" required placeholder="Client Care Lead" autoComplete="off" />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RolePermissionsDialog({ role }: { role: RoleRow }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [selected, setSelected] = React.useState<Set<AppPermission>>(() => new Set(role.permissions))

  // Re-sync from server data each time the dialog opens (no effect, no stale state).
  function handleOpenChange(next: boolean) {
    if (next) setSelected(new Set(role.permissions))
    setOpen(next)
  }

  function toggle(key: AppPermission, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function onSave() {
    startTransition(async () => {
      const res = await setRolePermissions(role.id, [...selected])
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Permissions updated", { description: `${role.name} access saved.` })
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Edit permissions</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{role.name} permissions</DialogTitle>
          <DialogDescription>
            Choose what this role can do. Changes apply on each member&apos;s next sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.module} className="border-border border-b py-3 first:pt-1 last:border-b-0">
              <p className="mb-2 text-sm font-medium">{group.module}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.permissions.map((perm) => {
                  const id = `perm-${role.id}-${perm.key}`
                  return (
                    <div key={perm.key} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={selected.has(perm.key)}
                        onCheckedChange={(v) => toggle(perm.key, v === true)}
                      />
                      <Label htmlFor={id} className="text-sm font-normal">
                        {perm.label}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending ? "Saving…" : "Save permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenameRoleDialog({ role }: { role: RoleRow }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await renameRole(role.id, fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Role renamed")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Rename ${role.name}`} />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Rename role</DialogTitle>
            <DialogDescription>Update this role&apos;s display name.</DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <Field label="Role name">
              <Input name="name" defaultValue={role.name} required autoComplete="off" />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteRoleButton({ role }: { role: RoleRow }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function onDelete() {
    startTransition(async () => {
      const res = await deleteRole(role.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Role deleted")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Delete ${role.name}`} />}>
        <Trash2 className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {role.name}?</DialogTitle>
          <DialogDescription>
            This removes the role for your firm. Members assigned to it must be reassigned first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// System roles are locked (rename/delete hidden); their permissions stay editable.
export function RoleRowActions({ role }: { role: RoleRow }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <RolePermissionsDialog role={role} />
      {!role.isSystem ? (
        <>
          <RenameRoleDialog role={role} />
          <DeleteRoleButton role={role} />
        </>
      ) : null}
    </div>
  )
}
