// The outbound emit core (spec 27): one place that turns a state change into delivered, signed,
// logged webhook events. Called from the shared leads core (Server Actions today; the API write
// endpoints later) so an event is identical whichever surface caused it.
//
// Phase 1 is BEST-EFFORT + NON-BLOCKING: a single delivery attempt per enabled+subscribed endpoint,
// each outcome recorded in webhook_deliveries. It NEVER throws into or blocks the caller — the whole
// body is wrapped so a webhook failure can never fail the user's action. Durable retry/backoff (a
// Vercel Cron worker draining `failed` rows, per spec 27) is an explicit FOLLOW-UP; the table
// already carries `status`/`attempts` for it.
//
// Delivery uses the service-role admin client (no user session), so every read/write is scoped to
// `firmId` EXPLICITLY (RLS does not apply here).
import type { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"
import { buildEvent, endpointWantsEvent, type WebhookEventType } from "./events"
import { signPayload, SIGNATURE_HEADER } from "./secret"

type Admin = ReturnType<typeof createAdminClient>

// A firm endpoint resolved for delivery. `secret` is the RAW signing secret, read from the
// service-role-only webhook_endpoint_secrets table (it's not a column on webhook_endpoints).
type DeliveryTarget = {
  id: string
  url: string
  secret: string
}

// Per-endpoint POST timeout: short, so one slow/hanging endpoint can't stall the request that
// triggered the emit (spec 27: "short timeouts so one slow/erroring endpoint can't block others").
const DELIVERY_TIMEOUT_MS = 5_000

type DeliveryOutcome = {
  status: "success" | "failed"
  responseStatus: number | null
  error: string | null
}

// POST the signed event to one endpoint, returning the outcome (never throws). Exported for the
// follow-up worker + tests; the body is signed exactly as a consumer must verify it.
export async function deliverOnce(target: DeliveryTarget, body: string): Promise<DeliveryOutcome> {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signPayload(target.secret, body, timestamp)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
  try {
    const res = await fetch(target.url, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signature },
      body,
      signal: controller.signal,
    })
    // 2xx = delivered; any other status is a failed attempt (the consumer rejected / errored).
    return {
      status: res.ok ? "success" : "failed",
      responseStatus: res.status,
      error: res.ok ? null : `Endpoint responded ${res.status}`,
    }
  } catch (err) {
    return {
      status: "failed",
      responseStatus: null,
      error: err instanceof Error ? err.message : "delivery_failed",
    }
  } finally {
    clearTimeout(timer)
  }
}

// Best-effort log of a delivery attempt; a logging failure must never fail anything.
async function recordDelivery(
  admin: Admin,
  row: {
    firmId: string
    endpointId: string
    eventType: WebhookEventType
    payload: Json
    outcome: DeliveryOutcome
  },
): Promise<void> {
  try {
    const { error } = await admin.from("webhook_deliveries").insert({
      firm_id: row.firmId,
      endpoint_id: row.endpointId,
      event_type: row.eventType,
      payload: row.payload,
      status: row.outcome.status,
      attempts: 1,
      response_status: row.outcome.responseStatus,
      error: row.outcome.error,
      delivered_at: new Date().toISOString(),
    })
    if (error) console.error("webhook delivery log failed:", error.message)
  } catch (err) {
    console.error("webhook delivery log failed:", err)
  }
}

// Emit one event to all of a firm's enabled endpoints that subscribe to its type. `data` is the
// resource already serialized to its public shape (serializeLead(...) for leads). Fire-and-forget
// from the caller's perspective — wrapped so nothing here can throw.
//
// The raw signing secret is NOT on webhook_endpoints (only its hash is, for the UI) — it lives in
// the service-role-only webhook_endpoint_secrets table, which the admin client reads here to sign.
export async function emitEvent(
  admin: Admin,
  firmId: string,
  type: WebhookEventType,
  data: Json,
): Promise<void> {
  try {
    const { data: endpoints, error } = await admin
      .from("webhook_endpoints")
      .select("id, url, event_types")
      .eq("firm_id", firmId)
      .eq("enabled", true)
    if (error) {
      console.error("webhook endpoint lookup failed:", error.message)
      return
    }

    const matching = (endpoints ?? []).filter((e) => endpointWantsEvent(e.event_types, type))
    if (matching.length === 0) return

    // Pull the raw secrets for just the matching endpoints (service-role-only table). An endpoint
    // missing its secret row (shouldn't happen — created atomically with the endpoint) is skipped:
    // signing without the consumer's secret would produce an unverifiable delivery.
    const { data: secretRows, error: secretErr } = await admin
      .from("webhook_endpoint_secrets")
      .select("endpoint_id, secret")
      .in(
        "endpoint_id",
        matching.map((e) => e.id),
      )
    if (secretErr) {
      console.error("webhook secret lookup failed:", secretErr.message)
      return
    }
    const secretByEndpoint = new Map((secretRows ?? []).map((r) => [r.endpoint_id, r.secret]))

    const targets: DeliveryTarget[] = matching.flatMap((e) => {
      const secret = secretByEndpoint.get(e.id)
      if (!secret) {
        console.error("webhook endpoint missing signing secret, skipping:", e.id)
        return []
      }
      return [{ id: e.id, url: e.url, secret }]
    })
    if (targets.length === 0) return

    const event = buildEvent(type, data)
    const body = JSON.stringify(event)

    // Deliver to all matching endpoints in parallel; each outcome is logged independently so one
    // bad endpoint doesn't affect the others. allSettled so a rejection can't escape.
    await Promise.allSettled(
      targets.map(async (t) => {
        const outcome = await deliverOnce(t, body)
        await recordDelivery(admin, {
          firmId,
          endpointId: t.id,
          eventType: type,
          payload: event as unknown as Json,
          outcome,
        })
      }),
    )
  } catch (err) {
    // Absolute backstop — emitting an event must NEVER fail the action that triggered it.
    console.error("emitEvent failed:", err)
  }
}
