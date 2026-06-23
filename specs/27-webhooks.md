# 27 · Outbound Webhooks

> **Module:** `webhooks` · **Status:** Draft · **Source:** Derived — the outbound counterpart to the
> [26-public-api](26-public-api.md) platform. Same per-firm, key/secret, "documented or it doesn't
> exist" ethos, pointed the other way: the system → the firm's systems.
> **Primary roles:** Admin, System/Service

## Purpose

The public API ([26]) lets external systems read and write the platform. **Outbound webhooks** are the
inverse: the platform **pushes events** to URLs a firm registers, so their tools react in real time
(a new lead → their Slack / CRM / automation) without polling. This is the event spine of every
integration.

**Policy: every capability that changes state emits its lifecycle events.** Just as every capability
ships an API endpoint ([26]), every create / update / delete enqueues a `resource.action` event. The
event catalog grows with the app and is documented alongside the OpenAPI contract — built **and kept up
to date** as features land, never bolted on later.

## Principles / decisions

1. **Shared emit core.** State changes emit from one place (`lib/events` / `lib/webhooks`), called by
   BOTH Server Actions and API handlers — never duplicated per surface (mirrors 26's shared-core rule).
   A change emits the same event whether it came from the app or the API.
2. **At-least-once, signed, retried.** Each delivery is an HMAC-signed POST with a unique id; failures
   retry with backoff; consumers dedupe on the delivery id. Signature in `Lawfficient-Signature`
   (HMAC-SHA256 of the raw body with the endpoint secret) + a timestamp to bound replay.
3. **Per-firm endpoints + secrets.** A firm registers endpoints, selects which events, and gets a signing
   secret (revealed once). Firm-scoped throughout; the admin client delivers (no user session).
4. **Observable + replayable.** Every attempt is logged (status, response code, retries) and replayable
   from the UI.

## Events

Naming: `resource.action` — e.g. `lead.created`, `lead.updated`, `lead.status_changed`,
`lead.assigned`, `lead.archived`. Payload: `{ "id", "type", "created_at", "data": <the resource, in the
same public shape the API returns> }`. The catalog is the union of every capability's lifecycle events;
**leads ship first**, the rest follow per the policy.

## Data model

- **`webhook_endpoints`** (per firm): `id`, `firm_id`, `url`, `secret_hash` (signing secret, hashed),
  `secret_last4`, `event_types text[]` (or `*` = all), `enabled`, `disabled_reason`, `created_at`.
- **`webhook_deliveries`** (the log): `id`, `firm_id`, `endpoint_id`, `event_type`, `payload jsonb`,
  `status` (pending | delivered | failed), `attempts`, `response_code`, `last_error`, `next_attempt_at`,
  `created_at`. Reuses the disposition/observability pattern of the inbound `webhook_events` ([23]).

> Note: `webhook_events` ([23]) logs **inbound** ingest deliveries; `webhook_deliveries` here logs
> **outbound** event deliveries. Same idea, opposite direction — keep them distinct.

## Delivery

- A worker (Vercel **Cron** draining the `webhook_deliveries` queue, or a managed queue later) POSTs the
  signed payload, records the result, and schedules retries with exponential backoff (cap N attempts →
  `failed`, surfaced in the UI; repeated failures can auto-disable the endpoint). Idempotent per delivery
  id; short timeouts so one slow/erroring endpoint can't block others.

## Roles & permissions

Reference [02-roles-and-permissions](02-roles-and-permissions.md).

| Role | Capability |
|------|------------|
| Admin (`settings.manage`) | Register / disable endpoints, choose events, reveal the secret once, view + replay deliveries. |
| System / Service | Emits events on state change; the worker delivers them. |
| Others | None — they consume the effects in their own tools. |

## Screens

- **Settings → Integrations** grows a **Webhooks** section: add endpoint (URL + event selection),
  reveal-once signing secret, enable/disable, and a deliveries log with replay — mirroring the existing
  Lead-sources editor.

## Rollout (phased)

- **Phase 1 — foundation + `lead.*`.** `webhook_endpoints` + `webhook_deliveries` migrations, the
  `lib/webhooks` emit + sign + deliver core, a Cron delivery worker, and emission of `lead.created` /
  `lead.updated` / `lead.status_changed` / `lead.assigned` / `lead.archived` from the leads Server
  Actions **and** the API ([26]). Sequence after the [26] foundation lands so migration numbers don't
  collide.
- **Phase 2 — management UI** in Settings → Integrations.
- **Phase 3+ — every other resource's events**, added as each feature ships (the policy).

## Acceptance criteria

- [ ] An admin can register a firm webhook endpoint, pick events, and get a signing secret once.
- [ ] A lead create / update / status-change / assign / archive delivers a signed `lead.*` event to
      subscribed endpoints; failures retry; every attempt is logged + replayable.
- [ ] Events emit identically whether the change came from the app (Server Action) or the API ([26]).

## Out of scope (v1) / future

- Consumer-side SDKs / helpers, per-event payload transformations, fan-out to third-party buses.

## Open questions

- Worker substrate — Vercel Cron polling `webhook_deliveries` vs a managed queue (Vercel Queues /
  QStash). Start with Cron + the table; revisit at volume.
- Retry policy specifics (max attempts, backoff schedule, auto-disable threshold).
