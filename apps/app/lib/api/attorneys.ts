// The STABLE public JSON shape for an attorney (spec 26) — the API contract, decoupled from the
// `profiles` DB columns. The public API otherwise exposes no way to discover staff, so an
// integration (e.g. a voice booking agent) can resolve its own attorney labels to the staff UUID
// that POST /api/consultations requires as `attorney_id`. Only the fields an integration needs are
// exposed; the rest of a profile (email, role, calendar color, firm_id) stays internal. ids are UUIDs.

export type ApiAttorney = {
  id: string
  name: string
  schedulable: boolean
  // Whether the attorney has ≥1 recurring office-hours window configured
  // (`attorney_availability`). `schedulable` is only an admin toggle — "takes
  // consultations" — but without office hours every booking fails
  // `outside_office_hours`, so this is the real "actually bookable" signal.
  // Filter the listing to only these with `?has_office_hours=true`.
  has_office_hours: boolean
}

// The `profiles` columns the attorney listing reads. `schedulable` rides along even though the
// listing only ever returns schedulable rows — it keeps the shape self-describing rather than
// implying a field the caller can't see. `has_office_hours` is NOT a profiles column: it's derived
// from a separate `attorney_availability` read and handed to the serializer.
export type AttorneyRow = {
  id: string
  name: string
  schedulable: boolean
}

export function serializeAttorney(row: AttorneyRow, hasOfficeHours: boolean): ApiAttorney {
  return {
    id: row.id,
    name: row.name,
    schedulable: row.schedulable,
    has_office_hours: hasOfficeHours,
  }
}
