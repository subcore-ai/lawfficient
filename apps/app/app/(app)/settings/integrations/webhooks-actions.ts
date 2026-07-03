"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/gate"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "@/lib/webhooks/events"
import { generateSecret } from "@/lib/webhooks/secret"
import { isSafeWebhookUrl } from "@/lib/webhooks/url"

import type { ActionResult } from "@/lib/actions/result"
// create returns the raw signing secret ONCE (it's never stored readably) so the UI can show it.
export type SecretResult = { ok: true; secret: string } | { error: string }

const PATH = "/settings/integrations"

// RLS (authorize('settings.manage'), firm-scoped) is the real gate; this returns a clean error first.
const requireAdmin = () => requirePermission("settings.manage", "integrations")

// Keep only known event types; drop anything else a crafted submit might include.
function cleanEventTypes(values: string[]): WebhookEventType[] {
  const known = new Set<string>(WEBHOOK_EVENT_TYPES)
  return values.filter((v): v is WebhookEventType => known.has(v))
}

export async function createWebhookEndpoint(formData: FormData): Promise<SecretResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const url = String(formData.get("url") ?? "").trim()
  if (!url) return { error: "Enter an endpoint URL." }
  if (!isSafeWebhookUrl(url))
    return { error: "Enter a public http(s) URL — localhost and private addresses aren't allowed." }

  const eventTypes = cleanEventTypes(formData.getAll("eventTypes").map(String))
  if (eventTypes.length === 0) return { error: "Select at least one event to send." }

  const { raw, hash, last4 } = generateSecret()

  // The endpoint row goes through the user client (RLS enforces firm + settings.manage; firm_id
  // defaults to current_firm_id()).
  const supabase = await createClient()
  const { data: endpoint, error } = await supabase
    .from("webhook_endpoints")
    .insert({ url, secret_hash: hash, secret_last4: last4, event_types: eventTypes })
    .select("id")
    .single()
  if (error || !endpoint) return { error: "Couldn't create the endpoint." }

  // The RAW secret goes to the service-role-only secrets table (denies the authenticated role), so
  // it must be written with the admin client + an explicit firm_id. If this fails, roll back the
  // endpoint row so we never leave one that can't be signed for.
  const admin = createAdminClient()
  const { error: secretErr } = await admin
    .from("webhook_endpoint_secrets")
    .insert({ endpoint_id: endpoint.id, firm_id: gate.user.firmId, secret: raw })
  if (secretErr) {
    // Roll back the endpoint so we never leave one that can't be signed for. If the rollback ALSO
    // fails the endpoint is orphaned (emitEvent skips it) — log it so it isn't silently lost.
    const { error: rollbackErr } = await admin.from("webhook_endpoints").delete().eq("id", endpoint.id)
    if (rollbackErr)
      console.error("webhook endpoint rollback failed (orphaned, no secret):", endpoint.id, rollbackErr.message)
    return { error: "Couldn't create the endpoint." }
  }

  revalidatePath(PATH)
  return { ok: true, secret: raw }
}

export async function setWebhookEndpointEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .update({ enabled })
    .eq("id", id)
    .select("id")
  if (error || !data || data.length === 0) return { error: "Couldn't update the endpoint." }

  revalidatePath(PATH)
  return { ok: true }
}

export async function deleteWebhookEndpoint(id: string): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  // The secret row + delivery log rows cascade on the endpoint FK (on delete cascade), so deleting
  // the endpoint cleans up everything.
  const supabase = await createClient()
  const { data, error } = await supabase.from("webhook_endpoints").delete().eq("id", id).select("id")
  if (error) return { error: "Couldn't delete the endpoint." }
  if (!data || data.length === 0) return { error: "That endpoint couldn't be deleted." }

  revalidatePath(PATH)
  return { ok: true }
}
