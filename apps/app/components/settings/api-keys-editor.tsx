"use client"

import * as React from "react"
import { KeyRound, Plus } from "lucide-react"

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

import { createApiKey, deleteApiKey, setApiKeyEnabled } from "@/app/(app)/settings/integrations/actions"
import { CopyButton } from "@/components/copy-button"
import { Field } from "@/components/form-field"
import { DeleteConfirmButton } from "@/components/settings/delete-confirm-button"
import { StatusPill } from "@/components/status-pill"
import { API_SCOPES, type ApiScope } from "@/lib/api/scopes"
import { formatDateTime } from "@/lib/format"

export type ApiKeyRow = {
  id: string
  name: string
  keyLast4: string
  scopes: string[]
  enabled: boolean
  createdAt: string
  lastUsedAt: string | null
}

// Human label for a scope (the raw value is what the API checks).
const SCOPE_LABEL: Record<ApiScope, string> = {
  "leads:read": "Read leads",
  "leads:write": "Write leads",
  "consultations:read": "Read consultations",
  "consultations:write": "Write consultations",
}
// Least-privilege default for a new key (read only).
const DEFAULT_SCOPES: Record<ApiScope, boolean> = {
  "leads:read": true,
  "leads:write": false,
  "consultations:read": true,
  "consultations:write": false,
}

// Shown ONCE after create — the raw key is never stored or shown again.
function KeyRevealDialog({
  rawKey,
  endpointUrl,
  onClose,
}: {
  rawKey: string | null
  endpointUrl: string
  onClose: () => void
}) {
  return (
    <Dialog open={rawKey !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Your API key</DialogTitle>
          <DialogDescription>
            Copy this now — it&apos;s shown only once. Anyone with this key can call the API as your firm.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">API key (Authorization: Bearer …)</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs">{rawKey}</code>
              <CopyButton value={rawKey ?? ""} label="Copy key" />
            </div>
          </div>
          <div className="text-muted-foreground rounded-lg border p-3 text-xs leading-relaxed">
            <p className="text-foreground mb-1 font-medium">Example</p>
            <code className="block break-all">
              curl {endpointUrl} -H &quot;Authorization: Bearer {rawKey}&quot;
            </code>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewApiKeyDialog({ onCreated }: { onCreated: (rawKey: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [scopes, setScopes] = React.useState<Record<ApiScope, boolean>>(DEFAULT_SCOPES)
  const [pending, startTransition] = React.useTransition()

  // Reset scope selections whenever the dialog closes, so reopening never inherits broader perms.
  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setScopes(DEFAULT_SCOPES)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    for (const s of API_SCOPES) fd.set(`scope:${s}`, scopes[s] ? "on" : "")
    startTransition(async () => {
      const res = await createApiKey(fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      onOpenChange(false)
      onCreated(res.rawKey)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" /> New API key
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New API key</DialogTitle>
            <DialogDescription>For programmatic access to the REST API. You&apos;ll see the key once.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="Name">
              <Input name="name" required placeholder="Zapier (production)" autoComplete="off" />
            </Field>
            <Field label="Scopes">
              <div className="flex flex-col gap-2">
                {API_SCOPES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={scopes[s]}
                      onCheckedChange={(v) => setScopes((prev) => ({ ...prev, [s]: v === true }))}
                    />
                    <span>{SCOPE_LABEL[s] ?? s}</span>
                    <code className="text-muted-foreground text-xs">{s}</code>
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ApiKeyCard({ apiKey, canManage }: { apiKey: ApiKeyRow; canManage: boolean }) {
  const [pending, startTransition] = React.useTransition()
  function toggleEnabled() {
    startTransition(async () => {
      const res = await setApiKeyEnabled(apiKey.id, !apiKey.enabled)
      if ("error" in res) toast.error(res.error)
    })
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{apiKey.name}</p>
        <StatusPill label={apiKey.enabled ? "Active" : "Disabled"} tone={apiKey.enabled ? "success" : "neutral"} dot />
      </div>
      <p className="text-muted-foreground font-mono text-xs">lak_••••{apiKey.keyLast4}</p>
      <div className="flex flex-wrap gap-1">
        {apiKey.scopes.length === 0 ? (
          <span className="text-muted-foreground text-xs">No scopes</span>
        ) : (
          apiKey.scopes.map((s) => (
            <span key={s} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[11px]">
              {s}
            </span>
          ))
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {apiKey.lastUsedAt ? `Last used ${formatDateTime(apiKey.lastUsedAt)}` : "Never used"}
      </p>
      {canManage ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggleEnabled} disabled={pending}>
            {apiKey.enabled ? "Disable" : "Enable"}
          </Button>
          <DeleteConfirmButton
            entityLabel={apiKey.name}
            title={`Delete ${apiKey.name}?`}
            description="The key stops working immediately. This can't be undone."
            confirmLabel="Delete key"
            successMessage="API key deleted"
            action={() => deleteApiKey(apiKey.id)}
          />
        </div>
      ) : null}
    </div>
  )
}

export function ApiKeysSection({
  keys,
  canManage,
  endpointUrl,
}: {
  keys: ApiKeyRow[]
  canManage: boolean
  endpointUrl: string
}) {
  const [rawKey, setRawKey] = React.useState<string | null>(null)
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4" /> API keys
            </p>
            <p className="text-muted-foreground text-xs">
              Bearer keys for the REST API — read or push leads programmatically.
            </p>
          </div>
          {canManage ? <NewApiKeyDialog onCreated={setRawKey} /> : null}
        </div>
        {keys.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No API keys yet.{canManage ? " Create one to call the API." : ""}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {keys.map((k) => (
              <ApiKeyCard key={k.id} apiKey={k} canManage={canManage} />
            ))}
          </div>
        )}
      </div>
      <KeyRevealDialog rawKey={rawKey} endpointUrl={endpointUrl} onClose={() => setRawKey(null)} />
    </>
  )
}
