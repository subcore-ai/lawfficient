// DB read for the public attorneys listing (spec 26), via the fail-safe tenant-scoped wrapper
// (tenant-db). The admin client bypasses RLS, so the read goes through `db.from(...)`, which pins
// the firm predicate by construction — an unscoped cross-firm read can't be written here.
//
// "Schedulable, active" mirrors exactly what the app's scheduling settings + booking form already
// treat as a bookable attorney (`schedulable = true` AND `status = 'active'`) — the same set the
// atomic api_book_consultation RPC accepts as `attorney_id`. But `schedulable` is only an admin
// toggle: an attorney with no office-hours windows (`attorney_availability`) is listed yet every
// booking fails `outside_office_hours`. So each row also carries `has_office_hours` (derived from a
// second firm-scoped read), and `?has_office_hours=true` filters to the genuinely bookable set.
//
// A firm's schedulable staff is a small, bounded set, so the listing is unpaginated: it returns the
// whole set and `next_cursor` is always null (the standard page envelope, no cursor to follow).
import { serializeAttorney, type ApiAttorney, type AttorneyRow } from "./attorneys"
import type { Page } from "./pagination"
import type { TenantDb } from "./tenant-db"

export interface AttorneyListOptions {
  /** When true, return only attorneys with ≥1 office-hours window. */
  hasOfficeHours?: boolean
}

// The firm's schedulable, active attorneys, name-ordered, each annotated with `has_office_hours`,
// in the standard page envelope. `?has_office_hours=true` narrows to the actually-bookable subset.
export async function getApiAttorneys(
  db: TenantDb,
  options: AttorneyListOptions = {},
): Promise<Page<ApiAttorney>> {
  const { data, error } = await db
    .from("profiles")
    .eq("schedulable", true)
    .eq("status", "active")
    // Name, then id as a tiebreaker so two attorneys sharing a display name get
    // a stable, reproducible order across requests (same convention as the
    // leads/consultations keyset).
    .order("name")
    .order("id")
  if (error) throw error

  const rows = (data ?? []) as AttorneyRow[]
  const withHours = await attorneysWithOfficeHours(db, rows)

  let attorneys = rows.map((row) => serializeAttorney(row, withHours.has(row.id)))
  if (options.hasOfficeHours) attorneys = attorneys.filter((a) => a.has_office_hours)

  return { data: attorneys, next_cursor: null }
}

// Set of attorney ids (from `attorneys`) that have ≥1 recurring office-hours window. One indexed,
// firm-scoped read over `attorney_availability`, bounded to the ids we're about to list.
// `attorney_availability` is the CURRENT weekly schedule (not accumulating history), so it's a small
// set — a handful of attorneys × weekdays × split shifts — well within one unpaginated read.
async function attorneysWithOfficeHours(
  db: TenantDb,
  attorneys: AttorneyRow[],
): Promise<Set<string>> {
  if (attorneys.length === 0) return new Set()
  const { data, error } = await db
    .from("attorney_availability")
    .in(
      "attorney_id",
      attorneys.map((a) => a.id),
    )
  if (error) throw error
  return new Set((data ?? []).map((row) => (row as { attorney_id: string }).attorney_id))
}
