// The canonical inbound contract — what a firm maps its source to (inside Zapier). Parsing is
// the anti-corruption boundary (spec 23, FR-ingest-1): every source normalizes to this shape
// before it reaches the leads core. Known core/data fields are normalized + extracted; any
// OTHER keys are kept verbatim in `extra` (FR-ingest-4: unmapped fields are never dropped).
import type { LeadDataInput, LeadVocab } from "@/lib/leads/data-schema"
import type { Json } from "@/lib/supabase/database.types"
import { normalizeEmail } from "@/lib/users/validation"

import { toE164 } from "./normalize-phone"

const KNOWN_KEYS = new Set<string>([
  // core (source/assignee come from the lead_source config, never the body)
  "firstName",
  "lastName",
  "email",
  "phone",
  "externalId",
  // data
  "caseType",
  "hierarchy",
  "qualification",
  "preferredLanguage",
  "countryOfOrigin",
  "city",
  "state",
  "zip",
  "gender",
  "dob",
  "referralSource",
])

export type ParsedPayload = {
  core: { firstName: string; lastName: string; email: string; phone: string }
  data: LeadDataInput
  extra: Record<string, Json>
  externalId: string | null
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim()
  // Coerce JSON numbers (Zapier/CRM maps often send a numeric externalId or zip) so they aren't
  // silently dropped — losing externalId would break idempotency and re-create leads on retry.
  if (typeof value === "number" && Number.isFinite(value)) {
    // …but an integer beyond 2^53 ALREADY lost precision at JSON.parse (JS has no 64-bit int), so
    // coercing it would risk a WRONG idempotency merge of two distinct deliveries. Refuse it — the
    // caller then treats externalId as absent (insert, never a bad merge). Large numeric IDs
    // should be sent as JSON strings.
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) return ""
    return String(value)
  }
  return ""
}

// Constrained fields arrive from external maps with arbitrary casing ("hrc" vs "HRC"); match the
// canonical vocabulary case-insensitively so a valid value isn't 400'd over casing alone. An
// unmatched value passes through unchanged → buildLeadData still rejects genuinely-invalid input.
function matchVocab(value: string, allowed: readonly string[]): string {
  if (!value) return value
  return allowed.find((a) => a.toLowerCase() === value.toLowerCase()) ?? value
}

export function parseCanonicalPayload(
  payload: Record<string, unknown>,
  vocab: LeadVocab,
  defaultCountry: "US" = "US"
): ParsedPayload {
  const rawPhone = str(payload.phone)
  const extra: Record<string, Json> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (!KNOWN_KEYS.has(k)) extra[k] = v as Json
  }

  return {
    core: {
      firstName: str(payload.firstName),
      lastName: str(payload.lastName),
      email: normalizeEmail(payload.email),
      // E.164 when parseable, else the raw string so nothing is lost.
      phone: rawPhone ? (toE164(rawPhone, defaultCountry) ?? rawPhone) : "",
    },
    data: {
      caseType: matchVocab(str(payload.caseType), vocab.caseType) || undefined,
      hierarchy: matchVocab(str(payload.hierarchy), vocab.hierarchy) || undefined,
      qualification: matchVocab(str(payload.qualification), vocab.qualification) || undefined,
      preferredLanguage: str(payload.preferredLanguage) || undefined,
      countryOfOrigin: str(payload.countryOfOrigin) || undefined,
      city: str(payload.city) || undefined,
      state: str(payload.state) || undefined,
      zip: str(payload.zip) || undefined,
      gender: str(payload.gender) || undefined,
      dob: str(payload.dob) || undefined,
      referralSource: str(payload.referralSource) || undefined,
    },
    extra,
    externalId: str(payload.externalId) || null,
  }
}
