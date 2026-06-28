"use client"

import * as React from "react"
import { Activity, Copy, KeyRound, Plus, Trash2 } from "lucide-react"

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

import {
  createSource,
  deleteSource,
  rotateKey,
  setDefaultAssignee,
  setSourceEnabled,
} from "@/app/(app)/settings/integrations/actions"
import { Field } from "@/components/form-field"
import { InlineSelect } from "@/components/inline-select"
import { StatusPill } from "@/components/status-pill"
import type { AssigneeOption } from "@/lib/leads/queries"
import { formatDateTime } from "@/lib/format"

export type LeadSourceRow = {
  id: string
  key: string
  name: string
  keyLast4: string
  enabled: boolean
  defaultAssigneeId: string | null
  lastEventAt: string | null
  lastStatus: string | null
  recentEvents: { status: string; externalId: string | null; error: string | null; receivedAt: string }[]
}

type Revealed = { rawKey: string; sourceKey: string }
const UNASSIGNED = "__none__"
// The fields a firm maps their source to inside Zapier (the canonical contract).
const CONTRACT_FIELDS =
  "externalId, firstName, lastName, email, phone, caseType, hierarchy, qualification, preferredLanguage, countryOfOrigin, city, state, zip, gender, dob, referralSource, notes"

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => toast.success("Copied"),
          () => toast.error("Couldn't copy")
        )
      }}
    >
      <Copy className="size-3.5" /> {label}
    </Button>
  )
}

// Shown ONCE after create/rotate — the raw key is never stored or shown again.
function KeyRevealDialog({
  revealed,
  webhookUrl,
  onClose,
}: {
  revealed: Revealed | null
  webhookUrl: string
  onClose: () => void
}) {
  return (
    <Dialog open={revealed !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Your webhook key</DialogTitle>
          <DialogDescription>
            Copy this now — it&apos;s shown only once. Anyone with this key can submit leads as your firm.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Webhook URL</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs">{webhookUrl}</code>
              <CopyButton value={webhookUrl} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">API key (Authorization: Bearer …)</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs">{revealed?.rawKey}</code>
              <CopyButton value={revealed?.rawKey ?? ""} label="Copy key" />
            </div>
          </div>
          <div className="text-muted-foreground rounded-lg border p-3 text-xs leading-relaxed">
            <p className="text-foreground mb-1 font-medium">Set it up in Zapier</p>
            <p>1. Add a “Webhooks by Zapier → POST” action and paste the URL above.</p>
            <p>
              2. Add a header <code>Authorization</code> with value <code>Bearer {revealed?.rawKey ? "<your key>" : ""}</code>.
            </p>
            <p>3. Map your source fields to: {CONTRACT_FIELDS}. Anything else is kept verbatim.</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewSourceDialog({
  assignees,
  onCreated,
}: {
  assignees: AssigneeOption[]
  onCreated: (r: Revealed) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [assignee, setAssignee] = React.useState(UNASSIGNED)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("defaultAssigneeId", assignee === UNASSIGNED ? "" : assignee)
    startTransition(async () => {
      const res = await createSource(fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setOpen(false)
      setAssignee(UNASSIGNED)
      onCreated({ rawKey: res.rawKey, sourceKey: res.sourceKey })
    })
  }

  const items = [{ value: UNASSIGNED, label: "Unassigned" }, ...assignees.map((a) => ({ value: a.id, label: a.name }))]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" /> New source
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New lead source</DialogTitle>
            <DialogDescription>
              Creates a webhook URL + key. New leads from this source land in your pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="Name">
              <Input name="name" required placeholder="Website form (Zapier)" autoComplete="off" />
            </Field>
            <Field label="Default assignee">
              <Select value={assignee} onValueChange={(v) => setAssignee(v ?? UNASSIGNED)} items={items}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ActivityDialog({ source }: { source: LeadSourceRow }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Activity className="size-4" /> Activity
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{source.name} — recent activity</DialogTitle>
          <DialogDescription>The latest ingest events for this source.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
          {source.recentEvents.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No events yet.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {source.recentEvents.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <StatusPill
                      label={e.status}
                      tone={e.status === "rejected" ? "danger" : e.status === "duplicate" ? "warning" : "success"}
                    />
                    {e.externalId ? <span className="text-muted-foreground ml-2 text-xs">{e.externalId}</span> : null}
                    {e.error ? <p className="text-destructive mt-0.5 truncate text-xs">{e.error}</p> : null}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">{formatDateTime(e.receivedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteSourceButton({ source }: { source: LeadSourceRow }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  function onDelete() {
    startTransition(async () => {
      const res = await deleteSource(source.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Source deleted")
      setOpen(false)
    })
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Delete ${source.name}`} />}>
        <Trash2 className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {source.name}?</DialogTitle>
          <DialogDescription>
            The webhook URL + key stop working immediately. Existing leads are unaffected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SourceCard({
  source,
  assignees,
  canManage,
  onRotated,
}: {
  source: LeadSourceRow
  assignees: AssigneeOption[]
  canManage: boolean
  onRotated: (r: Revealed) => void
}) {
  const [pending, startTransition] = React.useTransition()
  const assigneeItems = [{ value: UNASSIGNED, label: "Unassigned" }, ...assignees.map((a) => ({ value: a.id, label: a.name }))]

  function toggleEnabled() {
    startTransition(async () => {
      const res = await setSourceEnabled(source.id, !source.enabled)
      if ("error" in res) toast.error(res.error)
    })
  }
  function rotate() {
    startTransition(async () => {
      const res = await rotateKey(source.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      onRotated({ rawKey: res.rawKey, sourceKey: res.sourceKey })
    })
  }
  function assign(value: string) {
    startTransition(async () => {
      const res = await setDefaultAssignee(source.id, value === UNASSIGNED ? null : value)
      if ("error" in res) toast.error(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{source.name}</p>
        <StatusPill label={source.enabled ? "Active" : "Disabled"} tone={source.enabled ? "success" : "neutral"} dot />
      </div>
      <p className="text-muted-foreground font-mono text-xs">
        {source.key} · key lfk_••••{source.keyLast4}
      </p>
      <p className="text-muted-foreground text-xs">
        {source.lastEventAt
          ? `Last event: ${formatDateTime(source.lastEventAt)} · ${source.lastStatus}`
          : "No events yet"}
      </p>
      {canManage ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">Assignee</span>
          <InlineSelect
            value={source.defaultAssigneeId ?? UNASSIGNED}
            options={assigneeItems}
            ariaLabel="Default assignee"
            onValueChange={assign}
          />
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <ActivityDialog source={source} />
        {canManage ? (
          <>
            <Button variant="ghost" size="sm" onClick={rotate} disabled={pending}>
              <KeyRound className="size-4" /> Rotate key
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleEnabled} disabled={pending}>
              {source.enabled ? "Disable" : "Enable"}
            </Button>
            <DeleteSourceButton source={source} />
          </>
        ) : null}
      </div>
    </div>
  )
}

export function LeadSourcesSection({
  sources,
  assignees,
  canManage,
  webhookUrl,
}: {
  sources: LeadSourceRow[]
  assignees: AssigneeOption[]
  canManage: boolean
  webhookUrl: string
}) {
  const [revealed, setRevealed] = React.useState<Revealed | null>(null)
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Lead sources</p>
            <p className="text-muted-foreground text-xs">
              Capture leads automatically from Zapier or any tool that can POST a webhook.
            </p>
          </div>
          {canManage ? <NewSourceDialog assignees={assignees} onCreated={setRevealed} /> : null}
        </div>
        {sources.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No lead sources yet.{canManage ? " Create one to get a webhook URL + key." : ""}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sources.map((s) => (
              <SourceCard key={s.id} source={s} assignees={assignees} canManage={canManage} onRotated={setRevealed} />
            ))}
          </div>
        )}
      </div>
      <KeyRevealDialog revealed={revealed} webhookUrl={webhookUrl} onClose={() => setRevealed(null)} />
    </>
  )
}
