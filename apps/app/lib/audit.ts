import type { Database } from "@/lib/supabase/database.types"
import type { createClient } from "@/lib/supabase/server"

type DbClient = Awaited<ReturnType<typeof createClient>>
type AuditEntity = Database["public"]["Enums"]["audit_entity"]

export type AuditEntry = {
  entity: AuditEntity
  entityId: string
  label: string
  action: string
  byUserId: string
}

// Best-effort audit write — the ONE audit_log insert path shared by every server action. An audit
// failure (a returned RLS/constraint error OR a thrown network/timeout error) must never fail the
// user's action; it's surfaced in logs for visibility only, never re-thrown.
export async function recordAuditLog(supabase: DbClient, entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabase.from("audit_log").insert({
      entity: entry.entity,
      entity_id: entry.entityId,
      label: entry.label,
      action: entry.action,
      by_user_id: entry.byUserId,
    })
    if (error) console.error("audit_log insert failed:", error.message)
  } catch (err) {
    console.error("audit_log insert threw:", err)
  }
}
