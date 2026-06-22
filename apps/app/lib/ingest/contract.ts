// The canonical inbound contract — what a firm maps its source to (inside Zapier). Parsing is
// the anti-corruption boundary (spec 23, FR-ingest-1): every source normalizes to this shape
// before it reaches the leads core. Known core/data fields are normalized + extracted; any
// OTHER keys are kept verbatim in `extra` (FR-ingest-4: unmapped fields are never dropped).
import type { LeadDataInput } from "@/lib/leads/data-schema"
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
  "notes",
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
  core: { firstName: string; lastName: string; email: string; phone: string; notes: string }
  data: LeadDataInput
  extra: Record<string, Json>
  externalId: string | null
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim()
  // Coerce JSON numbers (Zapier/CRM maps often send a numeric externalId or zip) so they aren't
  // silently dropped — losing externalId would break idempotency and re-create leads on retry.
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

export function parseCanonicalPayload(
  payload: Record<string, unknown>,
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
      notes: str(payload.notes),
    },
    data: {
      caseType: str(payload.caseType) || undefined,
      hierarchy: str(payload.hierarchy) || undefined,
      qualification: str(payload.qualification) || undefined,
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
