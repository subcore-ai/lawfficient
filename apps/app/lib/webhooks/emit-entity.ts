// Emit a resource's `<entity>.*` webhook events AFTER the response is sent. Both write cores (leads and
// consultations) shape their events identically: skip an empty list, defer to next/server `after` so
// delivery never adds latency to the write, load the resource in its public API shape on a firm-scoped
// admin client, deliver each event via emitEvent, and NEVER throw — a webhook failure must never fail the
// write. That one path lives here; the domain modules just supply the `load` for their entity.
import { after } from "next/server"

import { tenantScoped, type TenantDb } from "@/lib/api/tenant-db"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"
import { emitEvent } from "./emit"
import type { WebhookEventType } from "./events"

// `entityName` labels the best-effort error log (e.g. "emitLeadEvents") so a failure stays diagnosable.
// `load` fetches the resource by id through the firm-scoped handle (getApiLeadById / getApiConsultationById),
// returning null when it doesn't exist / belongs to another firm — in which case nothing is emitted.
export function emitEntityEvents<T>(
  entityName: string,
  firmId: string,
  entityId: string,
  types: WebhookEventType[],
  load: (db: TenantDb, id: string) => Promise<T | null>,
): void {
  if (types.length === 0) return
  if (!firmId) return // best-effort: never run a firm-scoped read without firm context
  after(async () => {
    try {
      const admin = createAdminClient()
      const entity = await load(tenantScoped(admin, firmId), entityId)
      if (!entity) return // deleted out from under us, or not this firm's — nothing to emit
      for (const type of types) await emitEvent(admin, firmId, type, entity as unknown as Json)
    } catch (err) {
      console.error(`${entityName} failed:`, err)
    }
  })
}
