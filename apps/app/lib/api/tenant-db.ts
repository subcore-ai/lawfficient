// Fail-safe tenant scoping for the public API's reads (spec 26, "No RLS at the API layer"). The
// service-role admin client bypasses RLS, so a query that forgets `.eq("firm_id", …)` would read
// ACROSS firms — fail-open. This wrapper closes that hole: `from(table)` hands back a builder with
// the firm predicate already applied, so an unscoped read can't be written. The query layer only
// ever receives this scoped handle (never the raw admin client), so firm scoping is structural, not
// a convention each query has to remember. Read-only by design — writes go through the ingest path.
import type { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/database.types"

type Admin = ReturnType<typeof createAdminClient>
type Tables = Database["public"]["Tables"]

// Only tables that actually carry a firm_id column can be scoped — pointing the wrapper at a
// firm_id-less (or mistyped) table is a compile error, never a silent cross-tenant read.
type FirmScopedTable = {
  [K in keyof Tables]: Tables[K]["Row"] extends { firm_id: string } ? K : never
}[keyof Tables]

export type TenantDb = ReturnType<typeof tenantScoped>

// Build the firm-scoped data-access boundary the public API reads through. Callers get ONLY `from`
// (no escape hatch to the unscoped admin client), so every query is firm-scoped by construction.
export function tenantScoped(admin: Admin, firmId: string) {
  return {
    // `select("*")` over `table`, pinned to this firm. Returns the normal PostgrestFilterBuilder, so
    // callers keep the full chain (.eq/.order/.limit/.or/.maybeSingle/await) — they just can't drop
    // the firm predicate. The filter goes through `.match` (its `Record<string, unknown>` overload):
    // `.eq("firm_id", …)` can't be type-checked against the still-generic `T` here, while `.match`
    // injects the same `firm_id=eq.` predicate and keeps the row type intact.
    from<T extends FirmScopedTable>(table: T) {
      return admin.from(table).select("*").match({ firm_id: firmId })
    },
  }
}
