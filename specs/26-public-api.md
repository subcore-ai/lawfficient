# 26 · Public API Platform

> **Module:** `public-api` · **Status:** Draft · **Source:** Derived — the cross-cutting contract for
> programmatic access to every staff-platform capability. Builds on the firm-scoped key + reusable
> `lib/*` core proven by [23-lead-ingestion](23-lead-ingestion.md).
> **Primary roles:** System/Service, Admin

## Purpose

Everything the web app can do, an external system should be able to do too — programmatically,
per-firm, securely. This spec defines the **public REST API platform**: one consistent surface
(`/api/**`) that exposes the same capabilities as the staff platform, authenticated by **per-firm API
keys**. It is an *additional* surface, not a replacement — the web app keeps its Server Actions, and
**both the API and the actions call the same `lib/<domain>` core** (validation, queries, writes) so the
two can never diverge.

**Policy: every new app capability ships with a matching documented API endpoint** (+ OpenAPI + tests)
**and emits the corresponding webhook events** ([27-webhooks](27-webhooks.md), the outbound counterpart).
A PR that adds a capability without its endpoint + events is incomplete.

## Principles / decisions

1. **Shared core, two surfaces.** API route handlers and Server Actions both delegate to the same
   `lib/<domain>/*` modules (e.g. `lib/leads/validation`, `lib/leads/queries`). The route handler holds
   only auth, parsing, and serialization — no business logic.
2. **`/api/**`, no version in the path.** Resources are `/api/leads`, `/api/leads/{id}` — never
   `/api/v1/...`. Path versions age badly; versioning is **requested via a header** (see Versioning).
3. **Per-firm API keys (Bearer).** Auth extends the proven ingestion-key model: opaque keys stored
   **hashed** (`lib/ingest/keys.hashKey`), the firm resolved server-side from the key — never from the
   body. Keys carry **scopes** (`leads:read`, `leads:write`, …).
4. **Documented or it doesn't exist.** Every endpoint has an **OpenAPI 3.1** entry (the committed
   contract) and tests.

## Surface & conventions

- **Base:** `/api/**`. JSON in/out. Node runtime (key hashing, etc.).
- **Resources / verbs (REST):** `GET /api/leads` (list), `POST /api/leads` (create),
  `GET /api/leads/{id}`, `PATCH /api/leads/{id}` (partial update), `POST /api/leads/{id}/archive`.
- **Auth:** `Authorization: Bearer <key>`. Missing/invalid → 401; disabled → 403; missing scope → 403.
- **Errors:** one envelope — `{ "error": { "code": "snake_case", "message": "human readable",
  "details"?: ... } }` — with the correct status (400/401/403/404/409/422/429/5xx).
- **Pagination:** cursor-based — `?limit=` (default 50, max 200) + `?cursor=`; responses return
  `{ "data": [...], "next_cursor": string | null }`.
- **Filtering:** documented query params per resource (leads: `status`, `source`, `assignee`, `q`).
- **Idempotency (writes):** an `Idempotency-Key` header on POST returns the original result for a repeat
  (mirrors ingestion's `externalId` idempotency).
- **Rate limiting:** per firm/key, reusing the ingestion rate-limit approach; 429 + `Retry-After`.
- **Body limits (writes):** reject oversized payloads in two steps — the `Content-Length` header up
  front, then the actual `Buffer.byteLength` after reading (Content-Length can be absent or lie) — so a
  413 is returned **before** buffering an attacker-sized body. (Ingestion's `POST /api/leads` already
  does this; the rest of the write surface inherits the same guard.)
- **Timestamps:** ISO-8601 UTC. **IDs:** resource UUIDs.
- **No RLS at the API layer — so firm-scoping is fail-safe, not per-handler discipline.** Like
  ingestion, the API authenticates a key (no user session) and uses the **admin client**, which
  **bypasses RLS**. A forgotten `firm_id` filter is therefore fail-**open** (cross-tenant leak). Every
  API read/write goes through a **tenant-scoped data-access layer** — `lib/api/*-query` helpers that
  take `firmId` and always apply it, ideally a thin wrapper that injects the `firm_id` predicate so an
  unscoped query can't be written. "Admin client used without a `firm_id` predicate" is a
  review-blocking defect.

## Versioning (header, not path)

- The path stays stable (`/api/leads`). Version is selected by a request header
  **`Lawfficient-Version`** (date-stamped, Stripe-style, e.g. `2026-07-01`); absent → the **latest
  stable** version. Breaking changes mint a new dated version and handlers branch on it. Responses echo
  the resolved version. v1 today is the implicit default — the header exists so future versions never
  require a URL change or break existing callers.
- **Header-less default — pin to the key (fast-follow).** Defaulting an absent header to *latest* is
  fine while there is one version, but becomes a footgun once a breaking version ships: a header-less
  client silently moves to the new behavior. Stripe avoids this by pinning a default version **to the
  API key** at creation. Add a `default_version` column to `api_keys` when the second dated version
  lands and fall back to *that*, not to *latest*; until then, absent → latest is safe.

## Auth & key management

- **`api_keys` table** (per firm): `id`, `firm_id`, `name`, `key_hash` (sha-256 — never the raw key),
  `key_last4`, `scopes text[]`, `enabled`, `created_at`, `last_used_at`. The raw key is shown **once** at
  creation, with a recognizable prefix (e.g. `lak_…`). RLS: a firm's admins (`settings.manage`)
  read/manage their own firm's keys; the API request path uses the admin client and resolves the firm
  from the **hashed** key.
- **Scopes:** `leads:read`, `leads:write` (extend per resource). Each endpoint declares its required
  scope; absence → 403.
- **Management UI:** Settings → Integrations grows an "API keys" section (generate / name / scope /
  reveal-once / disable / delete), mirroring the existing Lead-sources editor.
- **vs. ingestion keys ([23]):** those are *per-source*, ingestion-only (`lead_sources`). API keys are
  *per-firm*, scoped to the REST API. Separate tables — same hashing + firm-from-key model.

## One way to push a lead

There is a **single** endpoint for creating a lead — `POST /api/leads` — no matter who calls it.
Pushing a lead is pushing a lead; the platform does **not** split "ingestion" from "API create" into
different URLs. The handler resolves the firm from whichever Bearer key is presented:

- a **per-source ingestion key** ([23], `lead_sources`) → the lead is attributed to that source,
  idempotent on its `externalId`, and the delivery is logged to `webhook_events` (inbound dispositions);
- a **per-firm API key** (`api_keys`, scope `leads:write`) → a direct create, optionally idempotent via
  an `Idempotency-Key` header.

Both normalize to the same canonical payload and the same `lib/leads` core, so a lead is a lead however
it arrived. The existing `POST /api/leads` therefore **stays put** and is *extended* to also accept API
keys (Phase 2) — nothing is relocated.

## Rollout (phased)

- **Phase 1 — foundation + leads read.** `api_keys` migration + `lib/api/*` helpers
  (key→firm+scopes auth, error envelope, version header, rate limit), `GET /api/leads` (paginated,
  filterable) + `GET /api/leads/{id}`, OpenAPI scaffold + `GET /api/openapi.json`, tests. Read-only →
  low-risk; establishes every convention.
- **Phase 2 — leads writes.** Generalize `POST /api/leads` to also accept per-firm API keys (create —
  reuse `parseLeadInput` + the leads insert/upsert), `PATCH /api/leads/{id}`, archive — and emit the
  `lead.*` webhook events ([27]). The existing ingestion POST is unchanged; nothing relocates.
- **Phase 3 — API-key management UI** in Settings → Integrations.
- **Phase 4+ — the rest, per the policy:** consultations, clients, cases, documents, … each shipped
  with its endpoints + OpenAPI + tests as the app feature lands.

## Documentation

- **OpenAPI 3.1** is the source of truth, committed (e.g. `apps/app/app/api/openapi.json`) and served
  read-only at `GET /api/openapi.json`. Each resource PR adds/updates its paths + schemas. A rendered
  human reference can derive from it later.

## Acceptance criteria

- [ ] An admin can mint a scoped per-firm API key (revealed once, stored hashed).
- [ ] `GET /api/leads` + `GET /api/leads/{id}` work with a `leads:read` key, are firm-scoped, paginate,
      and filter; missing/disabled/wrong-scope keys return 401/403.
- [ ] The error envelope, version header, and rate-limit headers behave as specified.
- [ ] Every shipped endpoint has an OpenAPI entry + tests; the existing ingestion webhook still works.

## Out of scope (v1) / future

- OAuth2 / per-user tokens (third-party apps acting on a user's behalf) — keys only for now.
- OAuth2 / per-user tokens, GraphQL, bulk endpoints, published SDKs. (Outbound webhooks are **in**
  scope — see [27-webhooks](27-webhooks.md).)

## Resolved decisions

- **Versioning:** date-stamped header `Lawfficient-Version: <YYYY-MM-DD>` — not an integer, not a path
  segment (confirmed).
- **Lead push:** one endpoint `POST /api/leads` for both ingestion keys and API keys — no
  `/api/ingest/leads`, no route relocation (confirmed).
- **`Idempotency-Key` storage (Phase 2):** stored in a dedicated `api_idempotency_keys` table (0036),
  keyed unique on `(firm_id, api_key_id, idempotency_key)` with the original `{status, body}` recorded
  for replay. Server-side only (RLS enabled, no policies — reached via the admin client). Guarantees
  idempotency for sequential retries (the real use case); a TTL sweep (Vercel Cron) prunes aged rows.

## Open questions

- `Idempotency-Key` TTL sweep cadence + the durable rate-limiter (the in-memory limiter is per-instance
  on serverless — see `lib/api/rate-limit.ts`).
