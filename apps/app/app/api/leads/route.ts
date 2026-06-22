import { NextResponse, type NextRequest } from "next/server"

import { parseCanonicalPayload } from "@/lib/ingest/contract"
import { hashKey } from "@/lib/ingest/keys"
import { checkRateLimit, recordEvent, resolveSourceByKey, upsertLead } from "@/lib/ingest/store"
import { buildLeadData } from "@/lib/leads/data-schema"
import { parseLeadInput } from "@/lib/leads/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"
import { isSupabaseConfigured } from "@/lib/supabase/env"

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
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Ingestion is not configured." }, { status: 503 })
  }

  const rawKey = bearerKey(request)
  if (!rawKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 401 })
  }

  const body = await request.text()
  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 })
  }

  const admin = createAdminClient()
  const source = await resolveSourceByKey(admin, hashKey(rawKey))
  if (!source) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 })
  }
  if (!source.enabled) {
    return NextResponse.json({ error: "This source is disabled." }, { status: 403 })
  }

  if (!(await checkRateLimit(admin, source.id, RATE_LIMIT, RATE_WINDOW_SECONDS))) {
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

  const parsedPayload = parseCanonicalPayload(payload)
  const core = parseLeadInput({
    firstName: parsedPayload.core.firstName,
    lastName: parsedPayload.core.lastName,
    phone: parsedPayload.core.phone,
    email: parsedPayload.core.email,
    source: source.key, // resolved from the key, never the body
    notes: parsedPayload.core.notes,
  })
  const builtData = buildLeadData(parsedPayload.data)

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
