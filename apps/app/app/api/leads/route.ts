import { NextResponse, type NextRequest } from "next/server"

import { bearerKey } from "@/lib/api/auth"
import { readJsonObject } from "@/lib/api/body"
import { apiError, apiJson } from "@/lib/api/errors"
import { withApi } from "@/lib/api/handler"
import { parseIdempotencyKey } from "@/lib/api/idempotency"
import { resolveApiKey, touchApiKey } from "@/lib/api/keys"
import { getApiLeadsPage, type LeadFilters } from "@/lib/api/leads-query"
import { decodeCursor, parseLimit } from "@/lib/api/pagination"
import { rateLimitByKey } from "@/lib/api/rate-limit"
import { tenantScoped } from "@/lib/api/tenant-db"
import { resolveVersion, withVersion } from "@/lib/api/version"
import { parseCanonicalPayload } from "@/lib/ingest/contract"
import { hashKey } from "@/lib/ingest/keys"
import { checkRateLimit, recordEvent, resolveSourceByKey, upsertLead, type ResolvedSource } from "@/lib/ingest/store"
import { buildLeadData, type LeadDataInput } from "@/lib/leads/data-schema"
import { createLeadViaApi, emitLeadEvents } from "@/lib/leads/mutations"
import { parseLeadInput } from "@/lib/leads/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { groupTaxonomies, toLeadVocabAll } from "@/lib/taxonomies/queries"

// node:crypto (key hashing) + libphonenumber-js → Node runtime, not Edge.
export const runtime = "nodejs"

const MAX_BODY_BYTES = 64 * 1024
const RATE_LIMIT = 120 // events
const RATE_WINDOW_SECONDS = 60

// One way to push a lead (spec 26): POST /api/leads resolves the firm from WHICHEVER Bearer key is
// presented. We try the per-firm API key first (api_keys); if the key is one of those, it's a direct
// API create (scope `leads:write`, standard error envelope, optional Idempotency-Key). Otherwise we
// fall through to the existing per-source ingestion path (lead_sources) — UNCHANGED — so Zapier &
// co. keep working exactly as before. The two key tables are disjoint, so "try one, then the other"
// has no ambiguity: an api_keys hit is never a source, and vice-versa.
export async function POST(request: NextRequest) {
  // Needs the publishable env AND the server-only secret (the admin client throws without it);
  // check both up front so a misconfig is a clear 503, not an uncaught 500 deeper in.
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Ingestion is not configured." }, { status: 503 })
  }

  const rawKey = bearerKey(request)
  if (!rawKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 401 })
  }

  const admin = createAdminClient()

  // Try the per-firm API key first. A resolved (enabled) api_keys row → the direct-create path, which
  // owns its own scope check + error envelope + idempotency. A lookup blip → 503 (don't fall through
  // to ingestion and risk a duplicate create on a retry). Null → not an API key → ingestion below.
  let apiKey: Awaited<ReturnType<typeof resolveApiKey>>
  try {
    apiKey = await resolveApiKey(admin, hashKey(rawKey))
  } catch {
    return NextResponse.json({ error: "Temporarily unavailable." }, { status: 503 })
  }
  if (apiKey) {
    return createLeadFromApiKey(request, admin, apiKey)
  }

  return ingestFromSource(request, admin, rawKey)
}

// The per-source ingestion path (spec 23, Tier 0) — UNCHANGED behavior. Auth via an opaque per-source
// key (Bearer); the firm is resolved server-side from the key, NEVER the body. Idempotent on
// (firm, source, externalId). Reached only when the Bearer key is NOT a per-firm API key.
async function ingestFromSource(request: NextRequest, admin: ReturnType<typeof createAdminClient>, rawKey: string) {
  // Reject oversized payloads by Content-Length BEFORE buffering the body (DoS guard)…
  const declaredLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 })
  }
  const body = await request.text()
  // …then re-check the actual byte length (Content-Length may be absent/wrong; .length is chars).
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 })
  }

  let source: ResolvedSource | null = null
  try {
    source = await resolveSourceByKey(admin, hashKey(rawKey))
  } catch {
    // A transient lookup failure must NOT masquerade as a bad key (401 → Zapier stops retrying);
    // 503 signals "try again" so a real delivery isn't lost to a blip.
    return NextResponse.json({ error: "Temporarily unavailable." }, { status: 503 })
  }
  if (!source) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 })
  }
  if (!source.enabled) {
    return NextResponse.json({ error: "This source is disabled." }, { status: 403 })
  }

  if (!(await checkRateLimit(admin, source.firmId, source.id, RATE_LIMIT, RATE_WINDOW_SECONDS))) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(RATE_WINDOW_SECONDS) } }
    )
  }

  let payload: Record<string, unknown>
  try {
    const parsed = JSON.parse(body)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object")
    payload = parsed as Record<string, unknown>
  } catch {
    await recordEvent(admin, {
      firmId: source.firmId,
      sourceId: source.id,
      externalId: null,
      status: "rejected",
      rawPayload: { _unparsed: body.slice(0, 2000) },
      error: "Invalid JSON body.",
    })
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  // The firm's taxonomy vocabulary (admin client — the webhook has no user session, so RLS
  // doesn't apply; scope explicitly by firm). matchVocab normalizes casing against the firm's own
  // labels, and buildLeadData validates against them.
  const taxRes = await admin.from("firm_taxonomies").select("*").eq("firm_id", source.firmId).order("position")
  // A failed vocab load must NOT yield an empty vocab → buildLeadData would 400 valid payloads and
  // Zapier would stop retrying. 503 signals "try again" instead.
  if (taxRes.error) {
    return NextResponse.json({ error: "Temporarily unavailable." }, { status: 503 })
  }
  // Ingest accepts any firm-defined value (incl. deactivated) so a re-delivery carrying a
  // since-deactivated label still validates (mirrors updateLead's existing-value widening).
  const vocab = toLeadVocabAll(groupTaxonomies(taxRes.data ?? []))
  const parsedPayload = parseCanonicalPayload(payload, vocab)
  const core = parseLeadInput({
    firstName: parsedPayload.core.firstName,
    lastName: parsedPayload.core.lastName,
    phone: parsedPayload.core.phone,
    email: parsedPayload.core.email,
    source: source.key, // resolved from the key, never the body
  })
  const builtData = buildLeadData(parsedPayload.data, vocab)

  if (!core.ok || !builtData.ok) {
    const error = !core.ok ? core.error : !builtData.ok ? builtData.error : "Invalid payload."
    await recordEvent(admin, {
      firmId: source.firmId,
      sourceId: source.id,
      externalId: parsedPayload.externalId,
      status: "rejected",
      rawPayload: payload as Json,
      error,
    })
    return NextResponse.json({ error }, { status: 400 })
  }

  // Lead data = the verbatim unmapped extras + the validated known fields (known wins).
  const data = { ...parsedPayload.extra, ...builtData.value }

  try {
    const result = await upsertLead(admin, {
      firmId: source.firmId,
      source: source.key,
      externalId: parsedPayload.externalId,
      core: core.value,
      assigneeId: source.defaultAssigneeId,
      data,
    })
    await recordEvent(admin, {
      firmId: source.firmId,
      sourceId: source.id,
      externalId: parsedPayload.externalId,
      status: result.created ? "upserted" : "duplicate",
      leadId: result.leadId,
      rawPayload: payload as Json,
    })
    return NextResponse.json(
      {
        externalId: parsedPayload.externalId,
        status: result.created ? "created" : "updated",
        leadId: result.leadId,
      },
      { status: result.created ? 201 : 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed"
    await recordEvent(admin, {
      firmId: source.firmId,
      sourceId: source.id,
      externalId: parsedPayload.externalId,
      status: "rejected",
      rawPayload: payload as Json,
      error: message,
    })
    return NextResponse.json({ error: "Could not ingest the lead." }, { status: 500 })
  }
}

// The per-firm API-key create path (spec 26, Phase 2): a direct create with the STANDARD error
// envelope + version header (unlike ingestion's `{status, leadId}` shape). The key is already
// resolved; here we enforce the `leads:write` scope, rate-limit per key, honor an optional
// Idempotency-Key (store + replay), validate via the shared lib/leads core, and emit lead.created.
async function createLeadFromApiKey(
  request: NextRequest,
  admin: ReturnType<typeof createAdminClient>,
  apiKey: NonNullable<Awaited<ReturnType<typeof resolveApiKey>>>,
) {
  const version = resolveVersion(request.headers)
  const echo = (res: NextResponse) => withVersion(res, version)

  // Mirror the auth layer's status mapping for the cases withApi would otherwise handle.
  if (!apiKey.enabled) {
    return echo(apiError("key_disabled", "This API key is disabled.", 403))
  }
  if (!apiKey.scopes.includes("leads:write")) {
    return echo(apiError("insufficient_scope", "This API key is missing the required scope: leads:write.", 403))
  }
  // Best-effort observability touch, once authorized (same as the read path).
  void touchApiKey(admin, apiKey.keyId)

  const limit = rateLimitByKey(apiKey.keyId)
  if (!limit.ok) {
    const res = apiError("rate_limited", "Rate limit exceeded.", 429)
    res.headers.set("Retry-After", String(limit.retryAfterSeconds))
    return echo(res)
  }

  // Optional Idempotency-Key: the dedup is enforced ATOMICALLY by the DB (api_create_lead) — a repeat
  // with the same key returns the original lead, and a failed create leaves no reservation behind, so
  // there's no reserve/complete/release dance here. We only validate the header's length.
  const idem = parseIdempotencyKey(request.headers.get("idempotency-key"))
  if (!idem.ok) return echo(apiError("invalid_request", "Idempotency-Key is too long.", 400))

  const body = await readJsonObject(request)
  if (!body.ok) return echo(apiError(body.code, body.message, body.status))

  // `data`, if present, must be a JSON object — reject a primitive / array / null rather than
  // silently dropping it and creating the lead without the supplied fields.
  const rawData = body.value.data
  if (rawData !== undefined && (typeof rawData !== "object" || rawData === null || Array.isArray(rawData))) {
    return echo(apiError("invalid_request", "data must be an object.", 422))
  }
  const dataInput = rawData as LeadDataInput | undefined

  const result = await createLeadViaApi(
    admin,
    apiKey.firmId,
    {
      firstName: body.value.first_name,
      lastName: body.value.last_name,
      phone: body.value.phone,
      email: body.value.email,
      source: body.value.source,
      assignedToId: body.value.assignee_id,
      data: dataInput,
    },
    idem.key ? { apiKeyId: apiKey.keyId, key: idem.key } : undefined,
  )
  if (!result.ok) return echo(apiError(result.code, result.message, result.status))

  // `events` is empty on an idempotent replay, so a repeat emits nothing (no duplicate lead.created).
  emitLeadEvents(apiKey.firmId, result.lead.id, result.events)
  return echo(apiJson(result.lead as unknown as Json, 201))
}

// Public REST list (spec 26, Phase 1). Key-authed (scope `leads:read`); firm-scoped; newest-first;
// paginated (?limit, ?cursor) and filterable (?status, ?source, ?assignee, ?q). The handler does
// only parse + query + serialize — auth / version / rate-limit / errors live in withApi.
export async function GET(request: NextRequest) {
  return withApi(request, "leads:read", async ({ admin, context }) => {
    const params = request.nextUrl.searchParams
    const limit = parseLimit(params.get("limit"))

    const rawCursor = params.get("cursor")
    const cursor = decodeCursor(rawCursor)
    if (rawCursor && !cursor) {
      return apiError("invalid_cursor", "The cursor is invalid.", 400)
    }

    const filters: LeadFilters = {
      status: params.get("status") ?? undefined,
      source: params.get("source") ?? undefined,
      assignee: params.get("assignee") ?? undefined,
      q: params.get("q") ?? undefined,
    }

    const page = await getApiLeadsPage(tenantScoped(admin, context.firmId), limit, cursor, filters)
    return apiJson(page)
  })
}
