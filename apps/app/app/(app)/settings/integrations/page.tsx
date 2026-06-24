import { headers } from "next/headers"
import { ChevronDown, Code2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { MockTag } from "@/components/dev/mock-tag"
import { ConfigureIntegrationDialog } from "@/components/settings/settings-dialogs"
import { ApiKeysSection, type ApiKeyRow } from "@/components/settings/api-keys-editor"
import { LeadSourcesSection, type LeadSourceRow } from "@/components/settings/lead-sources-editor"
import { WebhooksSection, type WebhookEndpointRow } from "@/components/settings/webhooks-editor"
import { StatusPill } from "@/components/status-pill"
import { getCurrentUser } from "@/lib/auth/session"
import type { AssigneeOption } from "@/lib/leads/queries"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Settings · Integrations" }

const INTEGRATIONS: { name: string; desc: string; status: "connected" | "migrating" }[] = [
  { name: "RingCentral", desc: "Telephony — call tracking & disposition", status: "connected" },
  { name: "MyCase", desc: "Legacy case management — migration source", status: "migrating" },
  { name: "Docketwise", desc: "USCIS form preparation & auto-fill", status: "connected" },
  { name: "Jotforms", desc: "Client intake questionnaires", status: "connected" },
  { name: "Dropbox", desc: "Document storage & per-client folders", status: "connected" },
  { name: "USCIS", desc: "Case status lookup by receipt number", status: "connected" },
]

type Loaded = {
  sources: LeadSourceRow[]
  assignees: AssigneeOption[]
  endpoints: WebhookEndpointRow[]
  apiKeys: ApiKeyRow[]
  canManage: boolean
  webhookUrl: string
}

async function load(): Promise<Loaded> {
  const h = await headers()
  const host = h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? (host ? `${proto}://${host}` : "")).replace(/\/$/, "")
  const webhookUrl = origin ? `${origin}/api/leads` : "/api/leads"

  if (!isSupabaseConfigured()) {
    return { sources: [], assignees: [], endpoints: [], apiKeys: [], canManage: false, webhookUrl }
  }

  const me = await getCurrentUser()
  const supabase = await createClient()
  const [sourcesRes, assigneesRes] = await Promise.all([
    supabase
      .from("lead_sources")
      .select("id, key, name, key_last4, enabled, default_assignee_id")
      .order("created_at"),
    supabase.from("profiles").select("id, name").eq("status", "active").order("name"),
  ])
  if (sourcesRes.error) throw sourcesRes.error
  if (assigneesRes.error) throw assigneesRes.error

  const sourceRows = sourcesRes.data ?? []
  // One recent-events query per source so a high-volume source can't crowd out others (a single
  // global LIMIT would). RLS scopes each to the firm; a per-source failure degrades to no events.
  const eventResults = await Promise.all(
    sourceRows.map((s) =>
      supabase
        .from("webhook_events")
        .select("status, external_id, error, received_at")
        .eq("source_id", s.id)
        .order("received_at", { ascending: false })
        .limit(20)
    )
  )

  const sources: LeadSourceRow[] = sourceRows.map((s, i) => {
    const res = eventResults[i]
    const events =
      res && !res.error
        ? (res.data ?? []).map((e) => ({
            status: e.status,
            externalId: e.external_id,
            error: e.error,
            receivedAt: e.received_at,
          }))
        : []
    return {
      id: s.id,
      key: s.key,
      name: s.name,
      keyLast4: s.key_last4,
      enabled: s.enabled,
      defaultAssigneeId: s.default_assignee_id,
      lastEventAt: events[0]?.receivedAt ?? null,
      lastStatus: events[0]?.status ?? null,
      recentEvents: events,
    }
  })

  // Outbound webhook endpoints + their recent deliveries (RLS scopes both to the firm and
  // settings.manage; a non-admin sees an empty list). One deliveries query per endpoint so a
  // high-volume endpoint can't crowd out others.
  const { data: endpointRows } = await supabase
    .from("webhook_endpoints")
    .select("id, url, secret_last4, event_types, enabled, created_at")
    .order("created_at")
  const endpointList = endpointRows ?? []
  const deliveryResults = await Promise.all(
    endpointList.map((e) =>
      supabase
        .from("webhook_deliveries")
        .select("event_type, status, response_status, error, created_at")
        .eq("endpoint_id", e.id)
        .order("created_at", { ascending: false })
        .limit(20)
    )
  )
  const endpoints: WebhookEndpointRow[] = endpointList.map((e, i) => {
    const res = deliveryResults[i]
    const deliveries =
      res && !res.error
        ? (res.data ?? []).map((d) => ({
            eventType: d.event_type,
            status: d.status,
            responseStatus: d.response_status,
            error: d.error,
            createdAt: d.created_at,
          }))
        : []
    return {
      id: e.id,
      url: e.url,
      secretLast4: e.secret_last4,
      eventTypes: e.event_types,
      enabled: e.enabled,
      createdAt: e.created_at,
      recentDeliveries: deliveries,
    }
  })

  // Per-firm public-API keys (the api_keys_rw RLS policy scopes to the firm + settings.manage, so a
  // non-admin sees an empty list).
  const { data: apiKeyRows } = await supabase
    .from("api_keys")
    .select("id, name, key_last4, scopes, enabled, created_at, last_used_at")
    .order("created_at")
  const apiKeys: ApiKeyRow[] = (apiKeyRows ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    keyLast4: k.key_last4,
    scopes: k.scopes,
    enabled: k.enabled,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
  }))

  return {
    sources,
    assignees: (assigneesRes.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    endpoints,
    apiKeys,
    canManage: me?.permissions?.includes("settings.manage") ?? false,
    webhookUrl,
  }
}

export default async function SettingsIntegrationsPage() {
  const { sources, assignees, endpoints, apiKeys, canManage, webhookUrl } = await load()

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <LeadSourcesSection
            sources={sources}
            assignees={assignees}
            canManage={canManage}
            webhookUrl={webhookUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Connected systems
            <MockTag />
          </CardTitle>
          <CardDescription>Third-party tools and migration status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {INTEGRATIONS.map((it) => (
            <div key={it.name} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{it.name}</p>
                <StatusPill
                  label={it.status === "connected" ? "Connected" : "Migrating"}
                  tone={it.status === "connected" ? "success" : "warning"}
                  dot
                />
              </div>
              <p className="text-muted-foreground text-xs leading-snug">{it.desc}</p>
              <ConfigureIntegrationDialog name={it.name} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Developer access — programmatic REST API + outbound webhooks. Collapsed by default: most
          firms never touch this, so it stays out of the way. */}
      <details className="bg-card group rounded-xl border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Code2 className="text-muted-foreground size-4" />
            Developer access
            <span className="text-muted-foreground hidden font-normal sm:inline">
              — API keys &amp; webhooks; most firms won&apos;t need this
            </span>
          </span>
          <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-8 border-t p-4 pt-6">
          <ApiKeysSection keys={apiKeys} canManage={canManage} endpointUrl={webhookUrl} />
          <WebhooksSection endpoints={endpoints} canManage={canManage} />
        </div>
      </details>
    </div>
  )
}
