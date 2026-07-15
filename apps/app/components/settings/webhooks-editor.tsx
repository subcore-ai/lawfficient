"use client"

import * as React from "react"
import { Activity, Plus, Webhook } from "lucide-react"

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
import { toast } from "@workspace/ui/components/sonner"

import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  setWebhookEndpointEnabled,
} from "@/app/(app)/settings/integrations/webhooks-actions"
import { CopyButton } from "@/components/copy-button"
import { Field } from "@/components/form-field"
import { DeleteConfirmButton } from "@/components/settings/delete-confirm-button"
import { StatusPill } from "@/components/status-pill"
import { formatDateTime } from "@/lib/format"

export type WebhookDeliveryRow = {
  eventType: string
  status: string
  responseStatus: number | null
  error: string | null
  createdAt: string
}

export type WebhookEndpointRow = {
  id: string
  url: string
  secretLast4: string
  eventTypes: string[]
  enabled: boolean
  createdAt: string
  recentDeliveries: WebhookDeliveryRow[]
}

// The event catalog the UI offers, with a short human label. Kept in sync with WEBHOOK_EVENT_TYPES
// (lead + consultation lifecycle).
const EVENT_OPTIONS: { value: string; label: string }[] = [
  { value: "lead.created", label: "Lead created" },
  { value: "lead.updated", label: "Lead updated" },
  { value: "lead.status_changed", label: "Lead status changed" },
  { value: "lead.assigned", label: "Lead assigned" },
  { value: "lead.archived", label: "Lead archived" },
  { value: "consultation.booked", label: "Consultation booked" },
  { value: "consultation.rescheduled", label: "Consultation rescheduled" },
  { value: "consultation.canceled", label: "Consultation canceled" },
]

// Shown ONCE after create — the raw signing secret is never stored readably or shown again.
function SecretRevealDialog({ secret, onClose }: { secret: string | null; onClose: () => void }) {
  return (
    <Dialog open={secret !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Your signing secret</DialogTitle>
          <DialogDescription>
            Copy this now — it&apos;s shown only once. Use it to verify the{" "}
            <code>Lawfficient-Signature</code> header on every delivery.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Signing secret</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs">{secret}</code>
              <CopyButton value={secret ?? ""} label="Copy secret" />
            </div>
          </div>
          <div className="text-muted-foreground rounded-lg border p-3 text-xs leading-relaxed">
            <p className="text-foreground mb-1 font-medium">Verifying a delivery</p>
            <p>
              Each POST carries <code>Lawfficient-Signature: t=&lt;unix&gt;,v1=&lt;hmac&gt;</code>. Recompute
              the HMAC-SHA256 of <code>&lt;t&gt;.&lt;raw body&gt;</code> with this secret and compare; reject a
              mismatch or a timestamp older than a few minutes.
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewEndpointDialog({ onCreated }: { onCreated: (secret: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [pending, startTransition] = React.useTransition()

  function toggle(value: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(value)
      else next.delete(value)
      return next
    })
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selected.size === 0) {
      toast.error("Select at least one event to send.")
      return
    }
    const fd = new FormData(e.currentTarget)
    for (const v of selected) fd.append("eventTypes", v)
    startTransition(async () => {
      const res = await createWebhookEndpoint(fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setOpen(false)
      setSelected(new Set())
      onCreated(res.secret)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSelected(new Set())
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" /> Add endpoint
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New webhook endpoint</DialogTitle>
            <DialogDescription>
              We&apos;ll POST a signed event to this URL whenever a selected event happens.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="Endpoint URL">
              <Input name="url" type="url" required placeholder="https://example.com/webhooks/lawfficient" autoComplete="off" />
            </Field>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Events</p>
              <div className="flex flex-col gap-2">
                {EVENT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.has(opt.value)}
                      onCheckedChange={(checked) => toggle(opt.value, checked === true)}
                    />
                    <span>{opt.label}</span>
                    <code className="text-muted-foreground ml-auto text-xs">{opt.value}</code>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create endpoint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeliveriesDialog({ endpoint }: { endpoint: WebhookEndpointRow }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Activity className="size-4" /> Deliveries
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{endpoint.url}</DialogTitle>
          <DialogDescription>The latest delivery attempts for this endpoint.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
          {endpoint.recentDeliveries.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No deliveries yet.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {endpoint.recentDeliveries.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <StatusPill
                      label={d.status}
                      tone={d.status === "success" ? "success" : d.status === "failed" ? "danger" : "warning"}
                    />
                    <span className="text-muted-foreground ml-2 text-xs">{d.eventType}</span>
                    {d.responseStatus !== null ? (
                      <span className="text-muted-foreground ml-2 text-xs">HTTP {d.responseStatus}</span>
                    ) : null}
                    {d.error ? <p className="text-destructive mt-0.5 truncate text-xs">{d.error}</p> : null}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">{formatDateTime(d.createdAt)}</span>
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

function EndpointCard({
  endpoint,
  canManage,
}: {
  endpoint: WebhookEndpointRow
  canManage: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  const last = endpoint.recentDeliveries[0]

  function toggleEnabled() {
    startTransition(async () => {
      const res = await setWebhookEndpointEnabled(endpoint.id, !endpoint.enabled)
      if ("error" in res) toast.error(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{endpoint.url}</p>
        <StatusPill
          label={endpoint.enabled ? "Active" : "Disabled"}
          tone={endpoint.enabled ? "success" : "neutral"}
          dot
        />
      </div>
      <p className="text-muted-foreground font-mono text-xs">secret whsec_••••{endpoint.secretLast4}</p>
      <div className="flex flex-wrap gap-1">
        {endpoint.eventTypes.map((t) => (
          <span key={t} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[11px]">
            {t}
          </span>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {last ? `Last delivery: ${formatDateTime(last.createdAt)} · ${last.status}` : "No deliveries yet"}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <DeliveriesDialog endpoint={endpoint} />
        {canManage ? (
          <>
            <Button variant="ghost" size="sm" onClick={toggleEnabled} disabled={pending}>
              {endpoint.enabled ? "Disable" : "Enable"}
            </Button>
            <DeleteConfirmButton
              entityLabel={endpoint.url}
              title="Delete this endpoint?"
              titleClassName="truncate"
              description={`Deliveries to ${endpoint.url} stop immediately and its history is removed.`}
              confirmLabel="Delete endpoint"
              successMessage="Endpoint deleted"
              action={() => deleteWebhookEndpoint(endpoint.id)}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

export function WebhooksSection({
  endpoints,
  canManage,
}: {
  endpoints: WebhookEndpointRow[]
  canManage: boolean
}) {
  const [secret, setSecret] = React.useState<string | null>(null)
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Webhook className="size-4" /> Outbound webhooks
            </p>
            <p className="text-muted-foreground text-xs">
              Get a signed POST to your systems when leads change — in real time, no polling.
            </p>
          </div>
          {canManage ? <NewEndpointDialog onCreated={setSecret} /> : null}
        </div>
        {endpoints.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No endpoints yet.{canManage ? " Add one to receive events." : ""}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {endpoints.map((e) => (
              <EndpointCard key={e.id} endpoint={e} canManage={canManage} />
            ))}
          </div>
        )}
      </div>
      <SecretRevealDialog secret={secret} onClose={() => setSecret(null)} />
    </>
  )
}
