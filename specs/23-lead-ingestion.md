# 23 · Lead Ingestion & Source Connectors

> **Module:** `lead-ingestion` · **Status:** Draft · **Source:** Derived — the cross-cutting
> contract behind `FR-leads-1/2/12` (multi-source capture) and the multi-tenant decisions in
> [03-architecture-and-scope](03-architecture-and-scope.md).
> **Use cases:** UC2, UC3, UC6, UC7, UC43 · **Primary roles:** System/Service, Admin, Sales & Client Care

## Purpose

Every firm captures leads from different places — one uses a Google Sheet fed by Zapier,
another a website form, another a CRM, another inbound calls. This module exists so the platform
**never grows a bespoke integration into the leads core for each one**. All sources normalize to a
**single canonical inbound contract** and funnel through **one idempotent, firm-scoped ingest API**.
The [12-leads-crm](12-leads-crm.md) core never knows the source; onboarding a new firm (or a new
tool) becomes a thin adapter — usually just configuration.

```
sources (Sheets · Meta · web form · CSV · CRM · the AI voice agent)
   └─ thin mappers (source format → canonical LeadInbound)
        └─ POST /api/ingest/leads   (idempotent upsert, firm-scoped key)
             └─ leads core (12) — source-agnostic
```

This is the concrete realization of `FR-int-4` (providers abstracted behind internal interfaces).
Deep provider connectors (RingCentral telephony, MyCase migration) live in
[21-integrations](21-integrations.md); this spec owns the **normalized lead contract** they — and
Zapier/CSV/the voice agent — all feed.

## Connector strategy (tiers)

The point of the contract is to keep the number of **hand-built** connectors small.

| Tier | What | Per-firm engineering |
|------|------|----------------------|
| **0 — Universal** | Generic inbound **webhook** + **CSV import** + a hosted **web lead form** | **None.** Any iPaaS-supported source (Zapier/Make "Webhooks" → POST the endpoint) onboards with zero code. |
| **1 — Config** | Per-source **field mapping** stored as data ("their field X → our field Y") | A config row, not a deploy. |
| **2 — First-party** | Native connectors for high-frequency sources (e.g. Meta Lead Ads, HubSpot) | One adapter, demand-driven; still maps to the same `LeadInbound`. |

## Roles & permissions

Reference [02-roles-and-permissions](02-roles-and-permissions.md).

| Role | Capability in this module |
|------|---------------------------|
| System / Service | Authenticate with a firm-scoped ingest key; resolve callers; upsert leads; log dispositions. The AI voice agent is such a service. |
| Admin | Create/configure lead sources, field mappings, and ingest keys; view & replay ingest logs. |
| Sales & Client Care | Consume the result in [12-leads-crm](12-leads-crm.md); never touch ingest config. |

## Use cases

- **UC2 — Caller resolution (read side).** A producer resolves a phone/email to a record →
  `new_lead | existing_client | qualified_consult`, else "no match" (pairs with RingCentral in [21]).
- **UC3/UC43 — Inbound capture.** A source delivers a lead → normalized → upserted into the pipeline.
- **UC6/UC7 — Disposition & save.** A producer (incl. the voice agent) writes a call outcome / note
  back to the lead.
- **iPaaS ingest.** A firm wires Zapier/Make from their tool to the generic webhook — no platform code.
- **CSV / web form.** Bulk upload or a hosted form route through the same pipeline.

## Functional requirements

- **FR-ingest-1** — A single canonical `LeadInbound` schema; **all** sources normalize to it before
  reaching the leads core (anti-corruption boundary).
- **FR-ingest-2** — **Idempotent upsert** keyed on `(firmId, source, externalId)`; re-delivery
  updates, never duplicates.
- **FR-ingest-3** — **Per-firm scoped ingest key** resolves the tenant server-side; `firmId` in the
  body is never trusted; optional **HMAC signature** for webhooks; per-key rate limiting.
- **FR-ingest-4** — `rawPayload` is stored **verbatim** for every event; unmapped fields are never
  silently dropped — events are **replayable** after a mapping change.
- **FR-ingest-5** — **Config-driven field mapping** per source: onboarding a new layout requires
  no deploy (Tier 1).
- **FR-ingest-6** — A **generic inbound webhook** accepts any iPaaS payload + mapping → zero
  per-source code (Tier 0).
- **FR-ingest-7** — **CSV import** (`FR-leads-2`) and a hosted **web form** route through the same
  ingest pipeline.
- **FR-ingest-8** — **Cross-source duplicate detection** at ingest delegates to `FR-leads-12`:
  flag similar records, **never** overwrite or auto-merge across sources.
- **FR-ingest-9** — Phone is normalized to **E.164** and email lowercased at normalization, so
  resolution keys are consistent across every source.
- **FR-ingest-10** — Graceful degradation + audit (inherits `FR-int-2/3`): failures are logged with
  actionable errors, retried where safe, and surfaced — nothing is dropped.
- **FR-ingest-11** — **Caller resolution** read endpoint returns the `CallDisposition.callerType`
  classification for a phone/email (serves UC2 / `FR-leads-6`).
- **FR-ingest-12** — **Attribution** fields (`campaign`, `utm`, source identity) are captured when
  present, giving reporting a trustworthy channel that does not rely on the self-reported
  "how did you hear about us?" field.
- **FR-ingest-13** — The **AI voice agent** is a first-class producer (`source = voice_agent`) using
  the same key + contract for resolve, ingest, and disposition.

## Data model

- **LeadInbound** (the canonical payload every adapter produces) —
  `firmId` (from key, not body), `source`, `externalId` (idempotency/dedup), `capturedAt`
  (the source's real creation time, distinct from ingest time), then the [12](12-leads-crm.md)
  Lead fields: `firstName`, `lastName`, `phone`, `email`, `preferredLanguage?`, `referralSource?`,
  `countryOfOrigin?`, `currentCity?`, `state?`, `zip?`, `gender?`, `dob?`, `caseType?`,
  `caseHierarchy?` (`HRC|NHRC`), `notes?`, plus `campaign?` / `utm?` and **`rawPayload`** (verbatim).
- **LeadSource** — `id`, `firmId`, `kind` (`webhook|csv|web_form|connector|agent`),
  `provider?` (`google_sheets|meta_lead_ads|hubspot|…`), `mappingId?`, `keyRef`, `defaultAssignee?`,
  `status` (`active|paused|error`), `createdAt`.
- **SourceFieldMapping** — `id`, `firmId`, `sourceId`, `map[]` (`{from, to, transform?}`), `version`.
- **IngestEvent** — `id`, `firmId`, `sourceId`, `externalId?`, `status`
  (`received|normalized|upserted|duplicate|rejected`), `leadId?`, `rawPayloadRef`, `error?`,
  `receivedAt`. (Powers the log + replay; aligns with `IntegrationEvent` in [21].)

## API (the contract producers code against)

- `POST /api/ingest/leads` — single or batch; normalizes → dedupe-checks → idempotent upsert;
  returns per-item `{externalId, status, leadId?}`. The **one** endpoint every Tier-0/1/2 source targets.
- `GET  /api/leads/resolve?phone=|email=` — caller resolution → `{match, callerType, leadId?}`.
- `POST /api/leads/{id}/interactions` — disposition / note (maps to the `Interaction` entity in [12]).

All three use the same per-firm key; the voice agent (a separate service) is just another caller.

## Screens

- `/settings/sources` — list/configure lead sources, issue & rotate ingest keys, copy the webhook URL.
- `/settings/sources/{id}/mapping` — field-mapping editor (Tier 1).
- `/settings/sources/logs` — ingest event log with status, raw payload, and **replay**.

## Acceptance criteria

- [ ] The same lead delivered twice (same `source`+`externalId`) produces **one** record.
- [ ] A Zapier "Webhooks" POST from an arbitrary tool creates a lead with **no platform code**.
- [ ] A CSV upload and a web-form submission both land via the same pipeline with row-level errors.
- [ ] A new firm with a different field layout is onboarded by **mapping config only** (no deploy).
- [ ] Unmapped source fields are retained in `rawPayload` and recoverable via replay.
- [ ] A phone/email resolves to `new_lead | existing_client | qualified_consult` or "no match".
- [ ] Similar-but-distinct leads from different sources are flagged, never merged (`FR-leads-12`).
- [ ] An ingest with a bad/missing key is rejected and audit-logged; the body's `firmId` is ignored.

## Out of scope (v1) / future

- **Bi-directional sync** with source tools (mirrors [21]'s "one-time migration only").
- A public integration **marketplace** / self-serve connector SDK.
- Automated **lead scoring** on ingest (deferred in [12]).

## Decisions (v1)

- **Generic lead ingestion is native v1 infrastructure**, not a deferred "legal-tool integration."
  This does **not** contradict [03]/[21]'s "no legal-tool integrations in v1": Tier-0 ingestion
  (webhook + CSV + web form) is platform-native, in the same class as Stripe/Twilio/Supabase. The
  deferred items are deep provider connectors (RingCentral, MyCase migration).
- **First-party connectors (Tier 2) are fast-follow**, built only when a source recurs across firms.
  Until then every source rides Tier 0/1.
- **The AI voice agent is an external service** that authenticates with a firm-scoped key and uses
  this contract — it is a client of the platform, not a Lawfficient module.

## Open questions

- Ingest key model: one key per `LeadSource`, or one per firm with a `source` claim?
- Web lead form: hosted by the platform (Tier 0) vs. embeddable widget — v1 scope?
- Replay semantics after a mapping change: re-upsert in place vs. create a corrected revision.
