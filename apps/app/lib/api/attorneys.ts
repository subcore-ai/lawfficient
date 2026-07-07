// The STABLE public JSON shape for an attorney (spec 26) — the API contract, decoupled from the
// `profiles` DB columns. The public API otherwise exposes no way to discover staff, so an
// integration (e.g. a voice booking agent) can resolve its own attorney labels to the staff UUID
// that POST /api/consultations requires as `attorney_id`. Only the three fields an integration
// needs are exposed; the rest of a profile (email, role, calendar color, firm_id) stays internal.
// ids are UUIDs.

export type ApiAttorney = {
  id: string
  name: string
  schedulable: boolean
}

// The `profiles` columns the attorney listing reads. `schedulable` rides along even though the
// listing only ever returns schedulable rows — it keeps the shape self-describing rather than
// implying a field the caller can't see.
export type AttorneyRow = {
  id: string
  name: string
  schedulable: boolean
}

export function serializeAttorney(row: AttorneyRow): ApiAttorney {
  return {
    id: row.id,
    name: row.name,
    schedulable: row.schedulable,
  }
}
