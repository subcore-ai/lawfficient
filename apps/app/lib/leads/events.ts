import { getCurrentUser } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"

// Record a read-only lifecycle event on a lead's activity timeline (a kind='event' note row). Shared by
// the lead actions AND the consultation actions — a consultation's events surface on its lead's timeline.
//
// kind='event' is blocked for authenticated users by guard_notes, so events are written via the
// service-role admin client (which bypasses RLS). To keep that bypass safe, this helper is
// SELF-AUTHORIZING: it derives firm_id + author from the verified session (getCurrentUser), so it can
// only ever write an event for the current authenticated user, in their own firm — a caller can't forge
// the firm or author via arguments. Best-effort: a failed event log must never fail the underlying
// action. A null leadId (an orphaned consult whose lead was cleared) or an unauthenticated caller is a
// no-op.
export async function recordLeadEvent(leadId: string | null, body: string): Promise<void> {
  if (!leadId) return
  const user = await getCurrentUser()
  if (!user) return
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("notes").insert({
      firm_id: user.firmId,
      entity_type: "lead",
      entity_id: leadId,
      kind: "event",
      body,
      created_by_id: user.id,
    })
    if (error) console.error("lead event insert failed:", error.message)
  } catch (err) {
    console.error("lead event insert threw:", err)
  }
}
