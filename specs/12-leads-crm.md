# 12 · Leads & CRM

> **Module:** `leads` · **Status:** Draft · **Use cases:** UC2, UC3, UC4, UC5, UC6, UC7, UC16, UC43
> **Primary roles:** Sales & Client Care Staff, Attorneys, Admin

## Purpose

Capture leads from every source into one database, contact and qualify them, track them
through the conversion pipeline, and feed downstream consultation booking and retention. This
is the front door of the client lifecycle.

## Roles & permissions

| Role | Capability |
|------|-----------|
| Sales & Client Care | Full: enter/edit leads, call, dispose, qualify, book consultations, follow-up. |
| Attorney | View leads; set qualification & case hierarchy during/after consultation. |
| AR | Convert qualified lead → retained client; provision portal access. |
| Admin | Full + configure sources, assignment, fields. |

## Use cases

- **UC2 — Incoming Call & Caller Identification.** On a RingCentral call, match the phone
  number in the CRM; pull the record if found, else open a new-lead form.
- **UC3 — Updating an Existing Record.** Search by name/identifier; update contact details.
- **UC4 — Booking a Consultation** (intake form fields; see [13](13-consultations-scheduling.md)).
- **UC6 — Disposing a Call.** Pick caller type (New Lead / Existing Client / Qualified
  Consultation) and outcome; notes saved to CRM for tracking/reporting.
- **UC7 — Lead Saving & Follow-up Handling.** Call with no booking → auto-save as lead;
  may trigger follow-up SMS/reminders; flag whether qualified for follow-up.
- **UC16 — Tracking Lead Flow.** Move leads across pipeline stages (Consult Scheduled →
  Scheduled & Paid → Qualified Consults for Follow-Up → EA Sent → Retained).
- **UC43 — Lead Management & Conversion Tracking.** End-to-end: intake & assignment →
  contact & qualification (Qualified/Not Qualified/Pending Decision) → consultation booking &
  payment → outcome & retention → reporting (conversion per attorney/agent, productivity).

## Functional requirements

- **FR-leads-1** — Add/edit/delete leads from multiple sources (WhatsApp, social/Facebook,
  Call Rails, website ads, referrals).
- **FR-leads-2** — **Bulk import** leads via CSV.
- **FR-leads-3** — Auto-capture source, and capture intake fields: first/last name, phone,
  email, notes, preferred language, referral source, country of origin, current city, state of
  residency, zip, gender, date of birth, case hierarchy, case type.
- **FR-leads-4** — Assign leads to sales staff (auto on intake + manual reassignment), with
  notification to the assignee.
- **FR-leads-5** — Track lead status & conversion progress across pipeline stages.
- **FR-leads-6** — **Caller identification**: match inbound RingCentral number to a record;
  open new-lead form on no match (see [21-integrations](21-integrations.md)).
- **FR-leads-7** — **Call disposition** with caller type + outcome + notes, logged for reporting.
- **FR-leads-8** — Advanced search & filtering (source, status, assigned staff, date, case
  type, language, location).
- **FR-leads-9** — Per-lead **notes & interaction history** (calls, messages, dispositions).
- **FR-leads-10** — Qualification: `Qualified` (book consult, assign case type, set HRC/NHRC),
  `Not Qualified` (log reason), `Pending Decision` (reason, e.g. waiting for attorney notes /
  battery chart; set follow-up reminder).
- **FR-leads-11** — Unresponsive leads → follow-up cadence (calls, messages, reminders).
- **FR-leads-12** — **Duplicate detection** on intake (name, DOB, sex, nationality): store
  distinct records separately with unique IDs, flag similar ones (yellow), never overwrite
  (NFR §4.5).
- **FR-leads-13** — Convert qualified lead → retained client (handing to
  [14-retention-engagement](14-retention-engagement.md) / AR).

## Data model

- **Lead** — `id`, `firstName`, `lastName`, `phone`, `email`, `source`, `status`
  (`new|contacted|consult_scheduled|scheduled_paid|qualified_followup|ea_sent|retained|
  not_qualified|lost`), `qualification` (`qualified|not_qualified|pending`), `caseType?`,
  `caseHierarchy?` (`HRC|NHRC`), `assignedToUserId?`, `preferredLanguage`, `referralSource`,
  `countryOfOrigin`, `currentCity`, `state`, `zip`, `gender`, `dob`, `notes`, `createdAt`,
  `dedupeFlag?`.
- **Interaction** — `id`, `leadId`, `type` (`call|sms|email|note|disposition`), `direction`,
  `outcome`, `body`, `byUserId`, `at`.
- **CallDisposition** — `callerType` (`new_lead|existing_client|qualified_consult`),
  `outcome`, `notes`, `ringcentralCallId?`.

## Screens

- `/leads` — table with filters (source/status/assignee/case type/date), pipeline view,
  bulk CSV import, "Add lead".
- `/leads/[id]` — lead detail: profile, qualification controls, interaction history, "Book
  consultation", "Convert to client".
- Inbound-call popover (caller ID match) — surfaced globally when telephony is connected.

## Acceptance criteria

- [ ] A lead can be created, edited, assigned, and progresses through pipeline stages.
- [ ] CSV import creates leads and reports row-level errors.
- [ ] Filtering/search narrows the list by the documented facets.
- [ ] An inbound number that matches opens the record; a non-match opens a new-lead form.
- [ ] A call can be disposed with caller type + outcome + notes and appears in history.
- [ ] Similar-but-distinct leads are flagged, not merged or overwritten.
- [ ] Conversion rate per attorney and per sales agent is reportable (see [20](20-reporting-analytics.md)).

## Out of scope (v1) / future

- Automated lead scoring / AI prioritization.
- Two-way social-DM inbox (capture source only at first).

## Open questions

- Exact lead-assignment algorithm (round-robin, by language, by load?).
- Which fields are required at first capture vs. enriched later?
