# 16 · Documents

> **Module:** `documents` · **Status:** Draft · **Use cases:** UC18, UC31, UC33 (medical), UC37, UC39, UC41
> **Primary roles:** File Clerk, Legal Assistant(s), Attorneys, Client

## Purpose

Secure storage and lifecycle for all case documents: client uploads via the portal, inbound
mail processing, USCIS form preparation (Docketwise/Jotforms), document-submission tracking,
and per-client organization (Dropbox-linked). Closely related to
[15-case-management](15-case-management.md); this spec centers on the documents themselves.

## Roles & permissions

| Role | Capability |
|------|-----------|
| File Clerk | Process inbound mail; scan/upload/categorize; client comms; mailing confirmation. |
| Legal Assistant | Verify & check off submitted docs; act on received documents; prepare forms. |
| Attorney | Review forms/documents; ensure submissions. |
| Client | Upload requested documents via the portal. |

## Use cases

- **UC18 — Document Submission Tracking.** Per-case customizable checklist; system shows
  **% submitted** and pending list; LA verifies a submitted doc, checks it off (records name,
  date, comments); status/due/overdue/priority update; automated email/SMS reminders for
  outstanding docs; checklist shareable; progress visible any time.
- **UC31 — Inbound Mail Processing (File Clerk).** Scan/upload to Dropbox → auto-create client
  folder if missing → record FileClerk name, date, document category (USCIS mail / FBI prints /
  bona fides), document type (approval / RFE / interview notice), case type; generate Dropbox
  link per document; log approvals & case types for the **Results Received Report**; provide
  type-specific instructions/checklists; preloaded client-communication templates; mailing
  confirmation checklist; mis-categorized uploads flagged for manual review.
- **UC33 — Medical Inventory** (see [15-case-management](15-case-management.md)).
- **UC37 — Jotforms → Docketwise.** LA sends a unique Jotform link via the portal; client
  submits; data transfers to Docketwise and auto-fills USCIS forms (I-130, I-485, …); error
  detection & client follow-up; LA reviews & finalizes.
- **UC39 — Automated Form Identification & Legal Tips (Docketwise).** Create contact + matter
  by case type → Docketwise identifies required forms (e.g. VAWA → I-360, I-485, G-28) →
  per-form legal tips & document-requirement checks (e.g. sealed I-693 for I-485) → guided
  completion → assemble → review & submit.
- **UC41 — Data Validation & Error Correction.** Validate transferred form data (required
  fields, formats); flag errors; optional auto-correct minor formatting; trigger client
  follow-up for major gaps; LA reviews & finalizes.

## Functional requirements

- **FR-docs-1** — Secure document storage with per-client organization and **version control**
  (NFR §4.9), surfaced via Dropbox links.
- **FR-docs-2** — Client document upload via the [portal](18-client-portal.md); access control
  by role.
- **FR-docs-3** — **Per-case document checklist** (customizable) with %-complete, pending list,
  verification metadata (who/when/comments), due/overdue/priority, and shareability.
- **FR-docs-4** — **Automated reminders** (email/SMS) for outstanding documents based on due
  date and overdue status.
- **FR-docs-5** — **Inbound-mail intake**: scan/upload, auto client-folder creation,
  categorization (category/type/case type), Dropbox link generation, manual-review flag for
  mis-categorization.
- **FR-docs-6** — **Results Received Report** logging approvals, RFEs, and document types
  (monthly summaries) — feeds [20-reporting](20-reporting-analytics.md).
- **FR-docs-7** — Type-specific **instructions/checklists** for File Clerks (e.g. passport
  photo name-on-back; receipt-notice client notification).
- **FR-docs-8** — Preloaded **client-communication templates** for document notifications; and
  a **mailing-confirmation** checklist for physically mailed documents.
- **FR-docs-9** — **USCIS form preparation** via Docketwise: form identification by case type,
  auto-fill from Jotforms intake, per-form legal tips, document-requirement checks, assembly.
- **FR-docs-10** — **Form data validation** with error flagging, optional minor auto-correction,
  and client follow-up for major gaps.
- **FR-docs-11** — **Immigration form extraction** from uploaded USCIS forms into the platform,
  with real-time/scheduled refresh to keep forms current (source §1.2).

## Data model

- **Document** — `id`, `caseId`/`clientId`, `name`, `category` (`uscis_mail|fbi_prints|
  bona_fides|client_upload|form|medical|…`), `docType` (`approval|rfe|noid|interview_notice|
  receipt|…`), `caseType?`, `dropboxUrl`, `version`, `uploadedByUserId`, `uploadedAt`,
  `mailedAt?`, `trackingNumber?`, `flaggedForReview?`.
- **ChecklistItem** — `id`, `caseId`, `label`, `required`, `status` (`pending|submitted|
  verified`), `verifiedByUserId?`, `verifiedAt?`, `comments?`, `dueAt?`, `priority`.
- **FormPacket** — `id`, `caseId`, `forms[]` (`I-130|I-485|I-360|G-28|I-693|…`), `source`
  (`jotform|manual`), `validationErrors[]`, `status`.
- **CommsTemplate** — `id`, `name`, `channel`, `body` (placeholders).

## Screens

- `/documents` — document library (filter by client/case/category/type), inbound-mail intake,
  upload, Dropbox links.
- `/cases/[id]` → **Documents** tab: per-case checklist (% complete), pending list, verify/
  check-off, reminders.
- `/documents/forms` — USCIS form preparation status (Docketwise) & validation errors.
- `/documents/results` — Results Received Report.

## Acceptance criteria

- [ ] A case checklist shows %-complete and a pending list; verifying a doc records who/when.
- [ ] Outstanding documents trigger automated reminders by due/overdue status.
- [ ] Inbound mail is categorized, gets a Dropbox link, and creates a client folder if missing.
- [ ] Mis-categorized uploads are flagged for manual review.
- [ ] A Jotform submission auto-fills the case's USCIS forms; validation errors are flagged.
- [ ] Mailed documents store a mailing confirmation (date + tracking number).

## Out of scope (v1) / future

- Native in-platform form rendering/printing (rely on Docketwise initially).
- AI document classification (start rules + manual-review flag).

## Open questions

- Storage: Dropbox as system-of-record vs. platform-native storage with Dropbox sync?
- Docketwise/Jotforms API availability & auth model for v1.
- Versioning granularity and retention policy for legal documents.
