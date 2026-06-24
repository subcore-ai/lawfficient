"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { generateKey } from "@/lib/ingest/keys"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }
// create/rotate return the raw key ONCE (it's never stored) so the UI can show it.
export type KeyResult = { ok: true; rawKey: string; sourceKey: string } | { error: string }

const PATH = "/settings/integrations"

type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string }
type DbClient = Awaited<ReturnType<typeof createClient>>

// RLS (authorize('settings.manage'), firm-scoped) is the real gate; this returns a clean error first.
async function requireAdmin(): Promise<Gate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  if (!(user.permissions?.includes("settings.manage") ?? false))
    return { ok: false, error: "You don't have permission to manage integrations." }
  return { ok: true, user }
}

async function audit(supabase: DbClient, byUserId: string, sourceId: string, label: string, action: string) {
  try {
    await supabase
      .from("audit_log")
      .insert({ entity: "lead_source", entity_id: sourceId, label, action, by_user_id: byUserId })
  } catch {
    // best-effort
  }
}

// "Website form" -> "website_form"; the lead's `source` column gets this key.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export async function createSource(formData: FormData): Promise<KeyResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Enter a source name." }
  const key = slugify(name)
  if (!key) return { error: "Use letters or numbers in the source name." }
  const assignee = String(formData.get("defaultAssigneeId") ?? "")
  const defaultAssigneeId = assignee && assignee !== "none" ? assignee : null

  const { raw, hash, last4 } = generateKey()
  const supabase = await createClient()
  // firm_id defaults to current_firm_id().
  const { data, error } = await supabase
    .from("lead_sources")
    .insert({ name, key, key_hash: hash, key_last4: last4, default_assignee_id: defaultAssigneeId })
    .select("id")
    .single()
  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? "Another source already uses that name (or one too similar)."
          : "Couldn't create the source.",
    }
  }

  await audit(supabase, gate.user.id, data.id, name, "created")
  revalidatePath(PATH)
  return { ok: true, rawKey: raw, sourceKey: key }
}

export async function rotateKey(sourceId: string): Promise<KeyResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const { raw, hash, last4 } = generateKey()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("lead_sources")
    .update({ key_hash: hash, key_last4: last4 })
    .eq("id", sourceId)
    .select("id, name, key")
    .single()
  if (error || !data) return { error: "Couldn't rotate the key." }

  await audit(supabase, gate.user.id, sourceId, data.name, "key_rotated")
  revalidatePath(PATH)
  return { ok: true, rawKey: raw, sourceKey: data.key }
}

export async function setSourceEnabled(sourceId: string, enabled: boolean): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("lead_sources")
    .update({ enabled })
    .eq("id", sourceId)
    .select("id, name")
  if (error || !data || data.length === 0) return { error: "Couldn't update the source." }

  await audit(supabase, gate.user.id, sourceId, data[0]!.name, enabled ? "enabled" : "disabled")
  revalidatePath(PATH)
  return { ok: true }
}

export async function setDefaultAssignee(sourceId: string, assigneeId: string | null): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("lead_sources")
    .update({ default_assignee_id: assigneeId })
    .eq("id", sourceId)
    .select("id, name")
  if (error || !data || data.length === 0) return { error: "Couldn't update the assignee." }

  await audit(supabase, gate.user.id, sourceId, data[0]!.name, "assignee_updated")
  revalidatePath(PATH)
  return { ok: true }
}

export async function deleteSource(sourceId: string): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase.from("lead_sources").delete().eq("id", sourceId).select("id")
  if (error) return { error: "Couldn't delete the source." }
  if (!data || data.length === 0) return { error: "That source couldn't be deleted." }

  await audit(supabase, gate.user.id, sourceId, "", "deleted")
  revalidatePath(PATH)
  return { ok: true }
}

// ── Public API keys (Settings → Integrations, "Developer access") ────────────────────────────────
// Per-firm Bearer keys for the REST API at /api/** (0034). Same opaque-key + show-once model as lead
// sources, gated by the api_keys_rw RLS policy (settings.manage, firm-scoped). The `lak_` prefix marks
// them apart from ingestion keys (`lfk_`).
export const API_SCOPES = ["leads:read", "leads:write"] as const
export type ApiScope = (typeof API_SCOPES)[number]

// create returns the raw key ONCE (never stored) so the UI can show it.
export type ApiKeyResult = { ok: true; rawKey: string } | { error: string }

async function auditApiKey(supabase: DbClient, byUserId: string, keyId: string, label: string, action: string) {
  try {
    await supabase
      .from("audit_log")
      .insert({ entity: "api_key", entity_id: keyId, label, action, by_user_id: byUserId })
  } catch {
    // best-effort
  }
}

export async function createApiKey(formData: FormData): Promise<ApiKeyResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Enter a key name." }
  const scopes = API_SCOPES.filter((s) => formData.get(`scope:${s}`) === "on")
  if (scopes.length === 0) return { error: "Select at least one scope." }

  const { raw, hash, last4 } = generateKey("lak_")
  const supabase = await createClient()
  // firm_id defaults to current_firm_id(); the api_keys_rw RLS policy gates the write.
  const { data, error } = await supabase
    .from("api_keys")
    .insert({ name, key_hash: hash, key_last4: last4, scopes })
    .select("id")
    .single()
  if (error || !data) return { error: "Couldn't create the API key." }

  await auditApiKey(supabase, gate.user.id, data.id, name, "created")
  revalidatePath(PATH)
  return { ok: true, rawKey: raw }
}

export async function setApiKeyEnabled(keyId: string, enabled: boolean): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase.from("api_keys").update({ enabled }).eq("id", keyId).select("id, name")
  if (error || !data || data.length === 0) return { error: "Couldn't update the API key." }

  await auditApiKey(supabase, gate.user.id, keyId, data[0]!.name, enabled ? "enabled" : "disabled")
  revalidatePath(PATH)
  return { ok: true }
}

export async function deleteApiKey(keyId: string): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase.from("api_keys").delete().eq("id", keyId).select("id")
  if (error) return { error: "Couldn't delete the API key." }
  if (!data || data.length === 0) return { error: "That API key couldn't be deleted." }

  await auditApiKey(supabase, gate.user.id, keyId, "", "deleted")
  revalidatePath(PATH)
  return { ok: true }
}
