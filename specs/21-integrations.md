# 21 · Integrations

> **Module:** `integrations` · **Status:** Draft · **Use cases:** UC2, UC33 (migration), UC37, UC39, UC41
> **Primary roles:** System, Admin, Legal Assistant(s), File Clerk

## Purpose

Connect Lawfficient to the external systems an immigration firm depends on, and provide the
**risk-free migration** path off the legacy stack. Integrations are consumed by other modules
(telephony by Leads, forms by Documents, etc.); this spec is the integration system of record.

## Integrations

### RingCentral — telephony (UC2)
- Inbound call detection → caller identification against the CRM (match phone → record, else
  new-lead form); call tracking, **disposition**, and note-taking.
- Feeds [12-leads-crm](12-leads-crm.md) (caller ID, dispositions) and onboarding/callbacks.
- **FR-int-rc-1** — Receive call events; resolve caller; surface record or new-lead form.
- **FR-int-rc-2** — Persist call + disposition + notes linked to the lead/client.

### MyCase — legacy migration (UC33: "Migrating Data from MyCase Seamlessly")
- Extract via API or DB export: client details, case records (number/status/key dates),
  appointments/consultations, billing/invoices, documents (RFEs, NOIDs, engagement letters,
  retainers); map to Lawfficient's schema; clean/standardize; dedupe; import in batches;
  link documents to Dropbox; validate; **migration report** (records migrated, errors, pending
  manual fixes); run **in parallel** until verified, then go live.
- **FR-int-mc-1** — Automated extract → transform (mapping + cleaning) → load with dedup.
- **FR-int-mc-2** — Flag discrepancies/missing for manual review; CSV fallback if API fails.
- **FR-int-mc-3** — Produce a migration report and support parallel-run verification before
  cutover (addresses the [§4.11 migration-fear](00-product-overview.md) business problem).

### Docketwise + Jotforms — USCIS form preparation (UC37, UC39, UC41)
- Jotform intake (sent via portal) → data transfer to Docketwise → auto-fill USCIS forms →
  form identification by case type → per-form legal tips & document checks → validation &
  error correction. Detailed in [16-documents](16-documents.md).
- **FR-int-dw-1** — Transfer Jotform submissions to Docketwise and auto-fill forms.
- **FR-int-dw-2** — Identify required forms by case type; surface legal tips & doc requirements.
- **FR-int-dw-3** — Validate form data; flag/auto-correct/follow-up on errors.

### USCIS — case-status lookup (UC26)
- Look up case status by **receipt number** to power monthly client updates.
- **FR-int-uscis-1** — Resolve status & processing time by receipt number; failure → manual flag.

### Dropbox — document storage (UC31, UC32)
- Per-client folders; generate document links surfaced in the platform; auto-create folders on
  inbound mail. Detailed in [16-documents](16-documents.md).
- **FR-int-db-1** — Create/resolve per-client folders; generate & store shareable links.

### Payments — processor(s)
- Card/ACH/PayPal processing, vaulting for recurring, split charges. Detailed in
  [17-billing-payments](17-billing-payments.md).

## Cross-cutting requirements

- **FR-int-1** — Integration credentials/config managed by Admin (see [22](22-admin-settings.md)),
  stored encrypted.
- **FR-int-2** — Each integration degrades gracefully: failures surface actionable errors and
  never silently drop data; retries where safe.
- **FR-int-3** — Integration events are audit-logged.
- **FR-int-4** — Integrations are abstracted behind internal interfaces so providers can change
  without large redevelopment (NFR §4.7).

## Data model

- **Integration** — `id`, `provider` (`ringcentral|mycase|docketwise|jotforms|uscis|dropbox|
  payments`), `status` (`connected|error|disconnected`), `config` (encrypted), `connectedAt`.
- **IntegrationEvent** — `id`, `provider`, `kind`, `payloadRef`, `status`, `at`, `error?`.
- **MigrationRun** — `id`, `source` (`mycase`), `counts{migrated,errors,pendingManual}`,
  `startedAt`, `completedAt?`, `reportUrl`.

## Screens

- `/settings/integrations` — connect/configure/monitor each provider (Admin).
- `/settings/integrations/migration` — MyCase migration runner + report.
- Telephony surfaces globally (inbound-call popover); forms surface in [16](16-documents.md).

## Acceptance criteria

- [ ] An inbound RingCentral call resolves a caller or opens a new-lead form.
- [ ] A MyCase migration runs extract→transform→load with dedup and a migration report; CSV
      fallback works; parallel run is supported before cutover.
- [ ] A Jotform submission auto-fills Docketwise forms; validation errors are flagged.
- [ ] A receipt number resolves USCIS status; failures flag for manual handling.
- [ ] Inbound mail creates a Dropbox folder/link.

## Out of scope (v1) / future

- Bi-directional sync with tools the firm is migrating away from (one-time migration only).
- A public integration marketplace.

## Open questions

- API availability/auth for RingCentral, MyCase, Docketwise, Jotforms, and USCIS in v1.
- USCIS lookup legality/mechanism and rate limits.
- Which integrations are required at launch vs. fast-follow.
