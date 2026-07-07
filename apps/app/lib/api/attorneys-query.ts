// DB read for the public attorneys listing (spec 26), via the fail-safe tenant-scoped wrapper
// (tenant-db). The admin client bypasses RLS, so the read goes through `db.from(...)`, which pins
// the firm predicate by construction — an unscoped cross-firm read can't be written here.
//
// "Schedulable, active" mirrors exactly what the app's scheduling settings + booking form already
// treat as a bookable attorney (`schedulable = true` AND `status = 'active'`) — the same set the
// atomic api_book_consultation RPC accepts as `attorney_id`, so a caller can trust that every id
// listed here is bookable. Ordered by name for a stable, human-friendly listing (matches the app).
//
// A firm's schedulable staff is a small, bounded set, so the listing is unpaginated: it returns the
// whole set and `next_cursor` is always null (the standard page envelope, no cursor to follow).
import { serializeAttorney, type ApiAttorney } from "./attorneys"
import type { Page } from "./pagination"
import type { TenantDb } from "./tenant-db"

// The firm's schedulable, active attorneys, name-ordered, in the standard page envelope.
export async function getApiAttorneys(db: TenantDb): Promise<Page<ApiAttorney>> {
  const { data, error } = await db
    .from("profiles")
    .eq("schedulable", true)
    .eq("status", "active")
    .order("name")
  if (error) throw error

  return { data: (data ?? []).map((row) => serializeAttorney(row)), next_cursor: null }
}
