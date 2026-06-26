import { createAdminClient } from "@/lib/supabase/admin"

// Record a read-only lifecycle event on a lead's activity timeline (a kind='event' note row). Shared by
// the lead actions AND the consultation actions — a consultation's events surface on its lead's timeline.
//
// kind='event' is blocked for authenticated users by guard_notes, so events are written via the
// service-role admin client (which bypasses RLS, so firm_id must be set explicitly). Best-effort: a
// failed event log must never fail the underlying action. A null leadId (e.g. an orphaned consult whose
// lead was cleared) is a no-op.
export async function recordLeadEvent(
  firmId: string,
  leadId: string | null,
  body: string,
  byUserId: string,
): Promise<void> {
  if (!leadId) return
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("notes").insert({
      firm_id: firmId,
      entity_type: "lead",
      entity_id: leadId,
      kind: "event",
      body,
      created_by_id: byUserId,
    })
    if (error) console.error("lead event insert failed:", error.message)
  } catch (err) {
    console.error("lead event insert threw:", err)
  }
}
