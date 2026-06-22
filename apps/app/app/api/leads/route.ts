import { NextResponse, type NextRequest } from "next/server"

import { parseCanonicalPayload } from "@/lib/ingest/contract"
import { hashKey } from "@/lib/ingest/keys"
import { checkRateLimit, recordEvent, resolveSourceByKey, upsertLead, type ResolvedSource } from "@/lib/ingest/store"
import { buildLeadData } from "@/lib/leads/data-schema"
import { parseLeadInput } from "@/lib/leads/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { groupTaxonomies, toLeadVocab } from "@/lib/taxonomies/queries"

// node:crypto (key hashing) + libphonenumber-js → Node runtime, not Edge.
export const runtime = "nodejs"

const MAX_BODY_BYTES = 64 * 1024
const RATE_LIMIT = 120 // events
const RATE_WINDOW_SECONDS = 60

function bearerKey(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? ""
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

// Inbound lead webhook (spec 23, Tier 0). Auth via an opaque per-source key (Bearer); the firm
// is resolved server-side from the key, NEVER the body. Idempotent on (firm, source, externalId).
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

  const admin = createAdminClient()
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
  const vocab = toLeadVocab(groupTaxonomies(taxRes.data ?? []))
  const parsedPayload = parseCanonicalPayload(payload, vocab)
  const core = parseLeadInput({
    firstName: parsedPayload.core.firstName,
    lastName: parsedPayload.core.lastName,
    phone: parsedPayload.core.phone,
    email: parsedPayload.core.email,
    source: source.key, // resolved from the key, never the body
    notes: parsedPayload.core.notes,
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
