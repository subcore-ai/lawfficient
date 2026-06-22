// DB operations for ingestion, all via the service-role admin client (the webhook has no user
// session, so RLS doesn't apply — every write sets firm_id EXPLICITLY from the resolved key).
import type { Json } from "@/lib/supabase/database.types"
import { createAdminClient } from "@/lib/supabase/admin"

type Admin = ReturnType<typeof createAdminClient>

export type ResolvedSource = {
  id: string
  firmId: string
  key: string
  defaultAssigneeId: string | null
  enabled: boolean
}

// Resolve an opaque key (by its hash) to its source. The firm is read from this row — never
// from the request body (FR-ingest-3).
export async function resolveSourceByKey(admin: Admin, keyHash: string): Promise<ResolvedSource | null> {
  const { data, error } = await admin
    .from("lead_sources")
    .select("id, firm_id, key, default_assignee_id, enabled")
    .eq("key_hash", keyHash)
    .maybeSingle()
  // Distinguish a real lookup failure (throw → 503, Zapier retries) from "no such key" (null → 401).
  if (error) throw new Error("source_lookup_failed")
  if (!data) return null
  return {
    id: data.id,
    firmId: data.firm_id,
    key: data.key,
    defaultAssigneeId: data.default_assignee_id,
    enabled: data.enabled,
  }
}

// Trailing-window count over the event log (serverless has no reliable in-memory counter).
export async function checkRateLimit(
  admin: Admin,
  firmId: string,
  sourceId: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()
  // firm_id leads the (firm_id, source_id, received_at) index, so include it for tenant scope + speed.
  const { count, error } = await admin
    .from("webhook_events")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", firmId)
    .eq("source_id", sourceId)
    .gte("received_at", since)
  // Fail open on a transient metering error — a count glitch shouldn't drop legitimate leads — but log it.
  if (error) {
    console.error("rate-limit count failed:", error.message)
    return true
  }
  return (count ?? 0) < limit
}

type UpsertArgs = {
  firmId: string
  source: string
  externalId: string | null
  core: { firstName: string; lastName: string; email: string; phone: string; notes: string }
  assigneeId: string | null
  data: Record<string, Json>
}

export type UpsertResult = { leadId: string; created: boolean }

function asObject(value: Json | null | undefined): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json>) : {}
}

type CorePatch = { first_name?: string; last_name?: string; email?: string; phone?: string; notes?: string }

// On an idempotent re-delivery, overwrite ONLY the core columns the payload actually carries — an
// omitted/empty field must not blank an existing value (the data jsonb is merged for the same
// reason). first/last name are validated as required upstream, so they're always present; email,
// phone, and notes are optional. Pure + exported for unit testing.
export function coreUpdatePatch(core: UpsertArgs["core"]): CorePatch {
  const patch: CorePatch = {}
  if (core.firstName) patch.first_name = core.firstName
  if (core.lastName) patch.last_name = core.lastName
  if (core.email) patch.email = core.email
  if (core.phone) patch.phone = core.phone
  if (core.notes) patch.notes = core.notes
  return patch
}

// Idempotent upsert keyed on (firm, source, externalId). Re-delivery updates the core fields +
// merges data (new over old — never drops a field a human or prior event set) and bumps
// last_activity, but never touches status_id / assigned_to_id. Without an externalId, always insert.
export async function upsertLead(admin: Admin, args: UpsertArgs): Promise<UpsertResult> {
  const core = {
    first_name: args.core.firstName,
    last_name: args.core.lastName,
    email: args.core.email,
    phone: args.core.phone,
    notes: args.core.notes || null,
  }

  async function findExisting() {
    if (!args.externalId) return null
    const { data } = await admin
      .from("leads")
      .select("id, data")
      .eq("firm_id", args.firmId)
      .eq("source", args.source)
      .eq("external_id", args.externalId)
      .maybeSingle()
    return data
  }

  async function update(id: string, existingData: Json) {
    // Patch only the core columns the payload carries (coreUpdatePatch) so a re-delivery that omits
    // a field never blanks it; data is merged, not replaced, for the same reason.
    // .select().single() turns a 0-row / RLS-blocked / failed update into a real error instead of a
    // silent success (which would mislead the caller + the event log).
    const { error } = await admin
      .from("leads")
      .update({
        ...coreUpdatePatch(args.core),
        data: { ...asObject(existingData), ...args.data },
        last_activity: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id")
      .single()
    if (error) throw new Error("update_failed")
  }

  const existing = await findExisting()
  if (existing) {
    await update(existing.id, existing.data)
    return { leadId: existing.id, created: false }
  }

  // New lead → the firm's first open stage (lowest position, non-terminal). firm_id explicit.
  const { data: stage, error: stageErr } = await admin
    .from("lead_statuses")
    .select("id")
    .eq("firm_id", args.firmId)
    .eq("is_terminal", false)
    .order("position")
    .limit(1)
    .maybeSingle()
  if (stageErr) throw new Error("stage_lookup_failed")
  if (!stage) throw new Error("no_open_stage")

  const inserted = await admin
    .from("leads")
    .insert({
      firm_id: args.firmId,
      source: args.source,
      external_id: args.externalId,
      status_id: stage.id,
      assigned_to_id: args.assigneeId,
      ...core,
      data: args.data,
    })
    .select("id")
    .single()

  if (inserted.error) {
    // Race: a concurrent first-delivery won the unique (firm, source, external_id) → retry as update.
    if (inserted.error.code === "23505") {
      const raced = await findExisting()
      if (raced) {
        await update(raced.id, raced.data)
        return { leadId: raced.id, created: false }
      }
    }
    throw new Error("insert_failed")
  }
  return { leadId: inserted.data.id, created: true }
}

type EventArgs = {
  firmId: string
  sourceId: string
  externalId: string | null
  status: "received" | "normalized" | "upserted" | "duplicate" | "rejected"
  leadId?: string
  rawPayload: Json
  error?: string
}

// Best-effort log; a logging failure must never fail the request.
export async function recordEvent(admin: Admin, e: EventArgs): Promise<void> {
  try {
    await admin.from("webhook_events").insert({
      firm_id: e.firmId,
      source_id: e.sourceId,
      external_id: e.externalId,
      status: e.status,
      lead_id: e.leadId ?? null,
      raw_payload: e.rawPayload,
      error: e.error ?? null,
    })
  } catch {
    // swallow
  }
}
