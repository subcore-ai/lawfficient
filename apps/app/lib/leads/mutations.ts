// Shared lead-write core (spec 26: "one core, two surfaces"). The public API write endpoints and the
// app's Server Actions must apply the SAME validation and emit the SAME lead.* events, so the two can
// never diverge. The genuinely shared pieces live here:
//
//   - decideUpdateEvents — the event-mapping RULE (status change → lead.status_changed, assignee
//     change → lead.assigned, any other field → lead.updated). Pure + unit-tested; used by the PATCH
//     route to translate "what changed" into the events to emit.
//   - emitLeadEvents — the ONE emission path. Loads the lead in the public API shape (serializeLead,
//     via getApiLeadById) and delivers via emitEvent, so an API-emitted event is byte-identical to an
//     app-emitted one. Best-effort + non-blocking (next/server `after`): a webhook failure can never
//     fail the write. The Server Actions' emitLeadEvent delegates here.
//   - createLeadViaApi / updateLeadViaApi / setLeadArchivedViaApi — the admin-client write primitives
//     the API routes use. The API authenticates a KEY (no user session → RLS does not apply), so each
//     uses the service-role admin client and scopes firm_id EXPLICITLY (and asserts it on every read
//     and write), the same fail-safe discipline as the ingestion path. (The Server Actions keep their
//     RLS-scoped user client — RLS is their enforcement — and reuse the validation + event rules here.)
import { after } from "next/server"

import { getApiLeadById } from "@/lib/api/leads-query"
import { serializeLead, type ApiLead } from "@/lib/api/leads"
import { tenantScoped } from "@/lib/api/tenant-db"
import { isUuid } from "@/lib/api/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/database.types"
import { groupTaxonomies, toLeadVocabAll } from "@/lib/taxonomies/queries"
import { emitEvent } from "@/lib/webhooks/emit"
import type { WebhookEventType } from "@/lib/webhooks/events"
import { mapLeadRow, mapLeadStatus, type LeadStatusView } from "./queries"
import {
  buildLeadData,
  mergeLeadData,
  parseLeadData,
  type LeadDataInput,
  type LeadVocab,
} from "./data-schema"
import { parseLeadInput, parseLeadPatch } from "./validation"

type Admin = ReturnType<typeof createAdminClient>
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"]

// ── Shared event mapping ──────────────────────────────────────────────────────────────────────
// What changed in a (possibly combined) update → which lead.* events to emit. Mirrors the
// per-action mapping (setLeadStatus → status_changed, assignLead → assigned, updateLead → updated):
// a PATCH that changes several at once emits the union, deduped + in a stable order. Pure for tests.
export function decideUpdateEvents(changed: {
  status?: boolean
  assignee?: boolean
  other?: boolean
}): WebhookEventType[] {
  const events: WebhookEventType[] = []
  if (changed.other) events.push("lead.updated")
  if (changed.status) events.push("lead.status_changed")
  if (changed.assignee) events.push("lead.assigned")
  return events
}

// ── Shared emission ───────────────────────────────────────────────────────────────────────────
// Emit lead.* events AFTER the response is sent (next/server `after`) so webhook delivery never adds
// latency to the write. Best-effort: loads the lead in the public API shape, delivers via the admin
// client, and NEVER throws — a webhook failure must never fail the write. Both surfaces call this so
// the event payload is identical whichever caused it. No-ops on an empty event list.
export function emitLeadEvents(firmId: string, leadId: string, types: WebhookEventType[]) {
  if (types.length === 0) return
  after(async () => {
    try {
      const admin = createAdminClient()
      const lead = await getApiLeadById(tenantScoped(admin, firmId), leadId)
      if (!lead) return // deleted out from under us, or not this firm's — nothing to emit
      for (const type of types) await emitEvent(admin, firmId, type, lead)
    } catch (err) {
      console.error("emitLeadEvents failed:", err)
    }
  })
}

// ── API write primitives (admin client, explicit firm scope) ────────────────────────────────────
export type MutationResult =
  | { ok: true; lead: ApiLead; events: WebhookEventType[] }
  | { ok: false; status: number; code: string; message: string }

// The firm's taxonomy vocabulary, including INACTIVE labels — the API is a trusted machine source, so
// (like ingest) it accepts any value the firm has ever defined, not only the active ones. Throws on a
// lookup failure (→ the route maps it to a 503-style envelope) so an empty vocab never 400s valid input.
async function loadVocab(admin: Admin, firmId: string): Promise<LeadVocab> {
  const { data, error } = await admin
    .from("firm_taxonomies")
    .select("*")
    .eq("firm_id", firmId)
    .order("position")
  if (error) throw new Error("vocab_lookup_failed")
  return toLeadVocabAll(groupTaxonomies(data ?? []))
}

async function loadStatusMap(admin: Admin, firmId: string): Promise<Map<string, LeadStatusView>> {
  const { data, error } = await admin
    .from("lead_statuses")
    .select("*")
    .eq("firm_id", firmId)
    .order("position")
  if (error) throw new Error("status_lookup_failed")
  return new Map((data ?? []).map((row) => [row.id, mapLeadStatus(row)]))
}

// Serialize a freshly-written lead row to the public API shape. firm_id is asserted on the row as a
// belt-and-braces cross-tenant guard (the write already pinned it). Throws if the status can't be
// resolved (impossible given the composite FK) so a malformed event is never emitted.
function serializeRow(
  row: Parameters<typeof mapLeadRow>[0],
  statusesById: Map<string, LeadStatusView>,
  firmId: string,
): ApiLead {
  if (row.firm_id !== firmId) throw new Error("firm_scope_violation")
  const view = mapLeadRow(row, statusesById)
  if (!view) throw new Error("status_unresolved")
  return serializeLead(view)
}

// mapLeadRow consumes a full leads Row, so select every column it reads (incl. external_id, which the
// public serializer drops — no leak). firm_id is selected so serializeRow can assert tenant scope.
const SELECT_COLS =
  "id, firm_id, first_name, last_name, phone, email, source, external_id, assigned_to_id, status_id, archived, created_at, last_activity, data"

export type CreateLeadApiInput = {
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  email?: unknown
  source?: unknown
  assignedToId?: unknown
  data?: LeadDataInput
}

// Direct create from a per-firm API key (spec 26, "one way to push a lead"). Validates the core +
// data against the firm's vocab, lands the lead in the firm's first open stage, and returns the
// serialized lead + the lead.created event. firm_id is set EXPLICITLY (admin client bypasses RLS).
export async function createLeadViaApi(
  admin: Admin,
  firmId: string,
  input: CreateLeadApiInput,
): Promise<MutationResult> {
  const core = parseLeadInput(input)
  if (!core.ok) return { ok: false, status: 422, code: "invalid_request", message: core.error }

  // An assignee, if given, must be a uuid (it's the assigned_to_id column; a bad value would 500 on
  // the cast). We don't verify membership here — a wrong-firm id can't satisfy the FK and the insert
  // fails closed below.
  if (core.value.assignedToId && !isUuid(core.value.assignedToId)) {
    return { ok: false, status: 422, code: "invalid_request", message: "assignee_id must be a UUID." }
  }

  let vocab: LeadVocab
  try {
    vocab = await loadVocab(admin, firmId)
  } catch {
    return { ok: false, status: 503, code: "unavailable", message: "Temporarily unavailable." }
  }
  const built = buildLeadData(input.data ?? {}, vocab)
  if (!built.ok) return { ok: false, status: 422, code: "invalid_request", message: built.error }

  // First open stage (lowest position, non-terminal), this firm's.
  const { data: stage, error: stageErr } = await admin
    .from("lead_statuses")
    .select("id")
    .eq("firm_id", firmId)
    .eq("is_terminal", false)
    .order("position")
    .limit(1)
    .maybeSingle()
  if (stageErr) return { ok: false, status: 503, code: "unavailable", message: "Temporarily unavailable." }
  if (!stage) return { ok: false, status: 409, code: "no_open_stage", message: "No open pipeline stage is configured." }

  const { data: inserted, error } = await admin
    .from("leads")
    .insert({
      firm_id: firmId,
      first_name: core.value.firstName,
      last_name: core.value.lastName,
      phone: core.value.phone,
      email: core.value.email,
      source: core.value.source,
      assigned_to_id: core.value.assignedToId,
      status_id: stage.id,
      data: built.value,
    })
    .select(SELECT_COLS)
    .single()
  // A bad assignee (wrong firm / unknown) trips the composite FK (23503); surface it as a clean 422
  // rather than a generic 500.
  if (error?.code === "23503") {
    return { ok: false, status: 422, code: "invalid_request", message: "assignee_id is not a member of this firm." }
  }
  if (error || !inserted) return { ok: false, status: 500, code: "internal_error", message: "Couldn't create the lead." }

  const statusesById = await loadStatusMap(admin, firmId)
  const lead = serializeRow(inserted, statusesById, firmId)
  return { ok: true, lead, events: ["lead.created"] }
}

// Partial update from a per-firm API key. Loads the lead (firm-scoped), validates only the PROVIDED
// fields, applies core/source/assignee/status/data changes, and returns the serialized lead + the
// mapped events (decideUpdateEvents). A lead from another firm reads as 404 (never leaked).
export async function updateLeadViaApi(
  admin: Admin,
  firmId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<MutationResult> {
  if (!isUuid(id)) return { ok: false, status: 404, code: "not_found", message: "Lead not found." }

  const { data: existing, error: readErr } = await admin
    .from("leads")
    .select("phone, email, status_id, assigned_to_id, data")
    .eq("id", id)
    .eq("firm_id", firmId)
    .maybeSingle()
  if (readErr) return { ok: false, status: 503, code: "unavailable", message: "Temporarily unavailable." }
  if (!existing) return { ok: false, status: 404, code: "not_found", message: "Lead not found." }

  const core = parseLeadPatch(body, { phone: existing.phone, email: existing.email })
  if (!core.ok) return { ok: false, status: 422, code: "invalid_request", message: core.error }

  const patch = core.value
  const update: LeadUpdate = {}
  if (patch.firstName !== undefined) update.first_name = patch.firstName
  if (patch.lastName !== undefined) update.last_name = patch.lastName
  if (patch.phone !== undefined) update.phone = patch.phone
  if (patch.email !== undefined) update.email = patch.email
  if (patch.source !== undefined) update.source = patch.source

  // assignee: only when provided, and only when it actually changes (mirrors assignLead's no-op skip).
  let assigneeChanged = false
  if (patch.assignedToId !== undefined) {
    if (patch.assignedToId && !isUuid(patch.assignedToId)) {
      return { ok: false, status: 422, code: "invalid_request", message: "assignee_id must be a UUID." }
    }
    if (patch.assignedToId !== existing.assigned_to_id) {
      update.assigned_to_id = patch.assignedToId
      assigneeChanged = true
    }
  }

  // status: by the firm-defined status KEY (the public shape exposes key+name, never the raw id), and
  // only when it changes (mirrors setLeadStatus's no-op skip).
  let statusChanged = false
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const statusKey = typeof body.status === "string" ? body.status.trim() : ""
    if (!statusKey) return { ok: false, status: 422, code: "invalid_request", message: "status can't be empty." }
    const statusesById = await loadStatusMap(admin, firmId)
    const match = [...statusesById.values()].find((s) => s.key === statusKey)
    if (!match) return { ok: false, status: 422, code: "invalid_request", message: "Unknown status." }
    if (match.id !== existing.status_id) {
      update.status_id = match.id
      statusChanged = true
    }
  }

  // data: validate the PROVIDED data keys against the firm's vocab, then merge over the stored jsonb
  // (mergeLeadData replaces the known keys, preserves unsurfaced ones). Only when `data` is present.
  let dataChanged = false
  if (Object.prototype.hasOwnProperty.call(body, "data")) {
    const rawData = body.data
    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
      return { ok: false, status: 422, code: "invalid_request", message: "data must be an object." }
    }
    let vocab: LeadVocab
    try {
      vocab = await loadVocab(admin, firmId)
    } catch {
      return { ok: false, status: 503, code: "unavailable", message: "Temporarily unavailable." }
    }
    // Widen the vocab with the lead's current values so an unchanged-but-since-deactivated value still
    // validates (mirrors the Server Action's withExistingValues).
    const current = parseLeadData(existing.data)
    const widened: LeadVocab = {
      caseType: current.caseType ? [...vocab.caseType, current.caseType] : vocab.caseType,
      hierarchy: current.hierarchy ? [...vocab.hierarchy, current.hierarchy] : vocab.hierarchy,
      qualification: current.qualification
        ? [...vocab.qualification, current.qualification]
        : vocab.qualification,
    }
    const built = buildLeadData(rawData as LeadDataInput, widened)
    if (!built.ok) return { ok: false, status: 422, code: "invalid_request", message: built.error }
    update.data = mergeLeadData(existing.data, built.value)
    dataChanged = true
  }

  const coreChanged =
    patch.firstName !== undefined ||
    patch.lastName !== undefined ||
    patch.phone !== undefined ||
    patch.email !== undefined ||
    patch.source !== undefined

  // Nothing actually changed → return the lead unchanged, emit nothing (idempotent no-op PATCH).
  if (Object.keys(update).length === 0) {
    const lead = await getApiLeadById(tenantScoped(admin, firmId), id)
    if (!lead) return { ok: false, status: 404, code: "not_found", message: "Lead not found." }
    return { ok: true, lead, events: [] }
  }

  update.last_activity = new Date().toISOString()
  const { data: updated, error } = await admin
    .from("leads")
    .update(update)
    .eq("id", id)
    .eq("firm_id", firmId)
    .select(SELECT_COLS)
    .single()
  if (error?.code === "23503") {
    return { ok: false, status: 422, code: "invalid_request", message: "assignee_id is not a member of this firm." }
  }
  if (error || !updated) return { ok: false, status: 500, code: "internal_error", message: "Couldn't update the lead." }

  const statusesById = await loadStatusMap(admin, firmId)
  const lead = serializeRow(updated, statusesById, firmId)
  const events = decideUpdateEvents({
    status: statusChanged,
    assignee: assigneeChanged,
    other: coreChanged || dataChanged,
  })
  return { ok: true, lead, events }
}

// Archive / unarchive from a per-firm API key (mirrors setLeadArchived). Idempotent: a no-op (already
// in the requested state) returns the lead with no events. lead.archived on archive; lead.updated on
// restore (a restore is a generic state change, matching the Server Action).
export async function setLeadArchivedViaApi(
  admin: Admin,
  firmId: string,
  id: string,
  archived: boolean,
): Promise<MutationResult> {
  if (!isUuid(id)) return { ok: false, status: 404, code: "not_found", message: "Lead not found." }

  const { data: current, error: readErr } = await admin
    .from("leads")
    .select("archived")
    .eq("id", id)
    .eq("firm_id", firmId)
    .maybeSingle()
  if (readErr) return { ok: false, status: 503, code: "unavailable", message: "Temporarily unavailable." }
  if (!current) return { ok: false, status: 404, code: "not_found", message: "Lead not found." }

  // No-op (already archived/restored): return the lead, emit nothing.
  if (current.archived === archived) {
    const lead = await getApiLeadById(tenantScoped(admin, firmId), id)
    if (!lead) return { ok: false, status: 404, code: "not_found", message: "Lead not found." }
    return { ok: true, lead, events: [] }
  }

  const { data: updated, error } = await admin
    .from("leads")
    .update({ archived })
    .eq("id", id)
    .eq("firm_id", firmId)
    .select(SELECT_COLS)
    .single()
  if (error || !updated) return { ok: false, status: 500, code: "internal_error", message: "Couldn't archive the lead." }

  const statusesById = await loadStatusMap(admin, firmId)
  const lead = serializeRow(updated, statusesById, firmId)
  return { ok: true, lead, events: [archived ? "lead.archived" : "lead.updated"] }
}
