// The outbound webhook event registry (spec 27). Naming is `resource.action`; the catalog is the
// union of every capability's lifecycle events and GROWS with the app (the policy in spec 26/27).
// Phase 1 ships the lead lifecycle only — the rest follow as features land.
//
// An event's payload is the envelope `{ id, type, created_at, data }` where `data` is the resource
// in the SAME public shape the API returns (spec 26's serializeLead), so an app-emitted event and an
// API-emitted event are byte-identical.
import { randomUUID } from "node:crypto"

import type { Json } from "@/lib/supabase/database.types"

// Phase 1 lead lifecycle events. Extend this tuple (and nothing else) as each new resource ships.
export const LEAD_EVENT_TYPES = [
  "lead.created",
  "lead.updated",
  "lead.status_changed",
  "lead.assigned",
  "lead.archived",
] as const

// The full catalog (= every resource's events). Today it's just the lead events; future resources
// concatenate their own tuples here.
export const WEBHOOK_EVENT_TYPES = [...LEAD_EVENT_TYPES] as const

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]

// The signed envelope delivered to an endpoint. `id` is unique per event (consumers dedupe on it);
// `data` is the resource's public shape (e.g. ApiLead). Serialized to JSON as the POST body.
export type WebhookEvent = {
  id: string
  type: WebhookEventType
  created_at: string
  data: Json
}

// Build an event envelope with a fresh id + timestamp. `data` is the already-serialized public
// resource shape (serializeLead(...) for leads), passed as Json.
export function buildEvent(type: WebhookEventType, data: Json): WebhookEvent {
  return { id: randomUUID(), type, created_at: new Date().toISOString(), data }
}

// Does an endpoint subscribed to `subscribed` event types want `eventType`? `*` (or an empty list,
// treated as "none") is handled by the caller; this is the exact-match membership test. Pure +
// exported for unit testing the filtering.
export function endpointWantsEvent(subscribed: readonly string[], eventType: string): boolean {
  return subscribed.includes("*") || subscribed.includes(eventType)
}
