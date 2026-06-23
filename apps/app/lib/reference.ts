import "server-only"

import { unstable_cache } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/database.types"

// Firm "reference data" — pipeline statuses, taxonomies, active staff — changes rarely but is read on
// every leads / dashboard render. Cache it per firm with `unstable_cache` + a per-firm tag, and
// invalidate from the mutation actions via the *Tag helpers below. The short TTL is a safety net so a
// missed tag self-heals within a couple of minutes.
//
// These run OUTSIDE the request (unstable_cache), so they can't use the cookie-bound RLS client —
// they use the ADMIN client (service role, bypasses RLS) and therefore MUST filter by `firm_id`
// explicitly. Only ever pass a firmId that comes from the authenticated session
// (`getCurrentUser().firmId`) — never user input — since the admin client has no tenant boundary.
//
// Note: in `next dev` nothing is cached (pages always render on-demand), so the speedup + tag
// invalidation only take effect in a production build (preview / prod).

const TTL = 120 // seconds

type StatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"]
type TaxonomyRow = Database["public"]["Tables"]["firm_taxonomies"]["Row"]
// All firm staff (not just active) so callers can both build the active-only assignee picker AND
// resolve note/activity author names for since-deactivated members from one cached read.
export type StaffRow = { id: string; name: string; status: string }

export const statusesTag = (firmId: string) => `ref:statuses:${firmId}`
export const taxonomiesTag = (firmId: string) => `ref:taxonomies:${firmId}`
export const staffTag = (firmId: string) => `ref:staff:${firmId}`

export function getFirmStatusRows(firmId: string): Promise<StatusRow[]> {
  return unstable_cache(
    async () => {
      const { data, error } = await createAdminClient()
        .from("lead_statuses")
        .select("*")
        .eq("firm_id", firmId)
        .order("position")
      if (error) throw error
      return data ?? []
    },
    ["firm-statuses", firmId],
    { tags: [statusesTag(firmId)], revalidate: TTL },
  )()
}

export function getFirmTaxonomyRows(firmId: string): Promise<TaxonomyRow[]> {
  return unstable_cache(
    async () => {
      const { data, error } = await createAdminClient()
        .from("firm_taxonomies")
        .select("*")
        .eq("firm_id", firmId)
        .order("position")
      if (error) throw error
      return data ?? []
    },
    ["firm-taxonomies", firmId],
    { tags: [taxonomiesTag(firmId)], revalidate: TTL },
  )()
}

export function getFirmStaff(firmId: string): Promise<StaffRow[]> {
  return unstable_cache(
    async () => {
      const { data, error } = await createAdminClient()
        .from("profiles")
        .select("id, name, status")
        .eq("firm_id", firmId)
        .order("name")
      if (error) throw error
      return data ?? []
    },
    ["firm-staff", firmId],
    { tags: [staffTag(firmId)], revalidate: TTL },
  )()
}
