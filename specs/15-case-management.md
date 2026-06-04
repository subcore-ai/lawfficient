# 15 · Case Management

> **Module:** `cases` · **Status:** Draft · **Use cases:** UC17, UC18, UC19, UC20, UC21, UC22, UC28, UC29, UC30, UC32, UC33 (medical)
> **Primary roles:** Legal Assistant(s) & Lead, QA (Lead/Reviewer), Attorneys, Creative Writers, File Clerk, Management

## Purpose

The operational heart of the platform: track retained-client cases from onboarding through
packet preparation, multi-stage review with SLAs and red-flag escalation, declaration
drafting, QA sign-offs, RFE/NOID deadline management, and case-performance reporting.

## Roles & permissions

| Role | Capability |
|------|-----------|
| LA / LA Lead | Own packets; advance stages; gather docs; sign-off sheets; onboarding; monthly updates. LA Lead monitors pod. |
| QA Lead / Reviewer | Review packets; checklists; endorsements; sign-off monitoring. |
| Attorney | Document-review & office-attorney review stages; address RFE/NOID. |
| Creative Writer (+Lead) | Draft declarations through the declaration lifecycle. |
| File Clerk | Print packets, process inbound mail, track medicals, mailing confirmation. |
| Management | Red-flag alerts, overdue escalations, performance reports. |

## Use cases

- **UC17 — Tracking Case Progress & Deadlines (Retained Clients).** On EA signature, client
  becomes Hired/Retained; record case type, difficulty (1–3), date hired, expected packet
  completion timeframe (e.g. 56d VAWA+AOS, 20d VAWA+abeyance) → compute expected mailing date;
  track days since hired, assigned LA/manager/attorney, onboarding LA & completion; handle
  RFE/NOID due dates; VAWA-with-abeyance tracks abeyance-letter due (24–48h) & sent date;
  generate performance reports (turnaround exceedance, on-time completion, red-flag summary).
- **UC18 — Document Submission Tracking.** Per-case customizable checklist; **% submitted**;
  pending-documents list; verify & check off (records who/when); due date/overdue/priority;
  automated email/SMS reminders for outstanding docs; shareable checklist.
- **UC19 — Packet Stage Tracking & Red Flag.** Advance the 10-stage packet flow with per-stage
  SLAs; on SLA breach flag **Red Flag Client/Packet**, notify LA + team leads + management
  (email + system). See stages in [01-glossary](01-glossary-and-domain.md).
- **UC20 — Intake Assignments & Declaration Lifecycle.** Creative Writers' Lead assigns intake
  → declaration moves through 9 stages with SLAs; delays flag + notify; reassignment updates owner.
- **UC21 — Automated Task Endorsements & Sign-Off Tracking.** Case assignment creates tasks
  with SLA-based due dates; stage completion notifies the next role and creates their task;
  **sign-off sheets** must be uploaded before endorsing past Stage 4 and after Stage 4; missing
  sign-off **blocks progression** and alerts staff; delayed stages notify leads + management.
- **UC22 — QA Review Checklist.** Per-packet-type checklist with reference links; reviewer
  checks each item; submit only when complete; logged & stored; missing template alerts QA Lead.
- **UC28 — Onboarding Call Process.** On payment + assigned EA, create a prioritized LA task;
  RingCentral call with client details + suggested script; live EA status; log notes & schedule
  follow-ups; auto follow-up email/SMS if unreachable.
- **UC29 / UC40 — Automating Client Onboarding (all case types).** On Retained + case type,
  auto-create LA task and generate templated comms (welcome, intake questionnaire, intake
  briefing, onboarding, FBI/fingerprinting, medical exam) + auto-upload case-type documents
  (e.g. VAWA: welcome letter, battery chart, affidavit-of-support sample, evidence checklist;
  Marriage-based adds filing-fee breakdown); VAWA removes filing-fee references; verify
  completion; flag missing items; client communication preferences captured.
- **UC30 — RFE/NOID/Denial Deadline Tracking.** File Clerk uploads scanned RFE/NOID/denial;
  OCR extracts the due date → central deadline tracker; notify LA + attorney; reminder one week
  prior + escalations; integrate into attorney task list; OCR failure → manual-review flag.
- **UC32 — Packet Printing & Review (File Clerk).** At Stage 6, notify File Clerk team (Dropbox
  link, priority, LA, case type); print → attorney review queue → correction cycles → upload to
  Dropbox for client review → client approves or requests changes → final checklist → mailed
  (Stage 12) with mail date + tracking number saved.
- **UC33 — Medical Inventory Tracking.** Log received medicals (client, case type, due date,
  status In-Office/Sent-to-USCIS/Awaiting-RFE); match to existing RFE; notify one week before
  due (File Clerk/LA/attorney); escalate if not sent by deadline; searchable inventory.

## Functional requirements

- **FR-cases-1** — A **Case** is created when a client is retained, carrying case type,
  difficulty, hire date, assignments (LA, manager, attorney, onboarding LA), and a computed
  expected mailing date.
- **FR-cases-2** — **Packet stage tracker** with per-stage SLA timers, current owner, and
  history; advancing requires prerequisites (e.g. sign-off sheets) to be satisfied.
- **FR-cases-3** — **Red-flag** a case/packet when a stage exceeds its SLA; notify owner +
  leads + management via email + in-app.
- **FR-cases-4** — **Declaration lifecycle** (9 stages) for cases needing a declaration, with
  SLA timers, creative-writer assignment, and delay flagging.
- **FR-cases-5** — **Task & endorsement engine**: stage transitions auto-create the next
  owner's task with an SLA-based due date and notification.
- **FR-cases-6** — **Sign-off gating**: upload a completed sign-off sheet before/after Stage 4;
  block progression and alert when missing; track all sign-offs.
- **FR-cases-7** — **QA checklist** per packet type with reference links; submission requires
  all items; completed checklists are stored; missing template alerts QA Lead.
- **FR-cases-8** — **Document checklist** per case with %-complete, pending list, verification
  (who/when), due/overdue/priority, and automated reminders (see [16](16-documents.md)).
- **FR-cases-9** — **RFE/NOID/denial** deadline capture (OCR-assisted) into a central tracker
  with reminders, escalations, and attorney task integration; OCR-failure manual fallback.
- **FR-cases-10** — **Onboarding automation** by case type: tasks, templated comms, and
  document uploads, with filing-fee references conditional on case type; missing-item flags.
- **FR-cases-11** — **Packet printing/mailing** workflow (File Clerk) through Stage 12, storing
  mail date + tracking number.
- **FR-cases-12** — **Medical inventory** logging, RFE matching, due-date notifications, and
  search.
- **FR-cases-13** — **Case performance reporting**: turnaround exceedance, on-time completion,
  red-flag summary (feeds [20-reporting](20-reporting-analytics.md)).
- **FR-cases-14** — Reassignment mid-stage updates the responsible owner everywhere.
- **FR-cases-15** — Custom fields on cases and packets (NFR maintainability).

## Data model

- **Case** — `id`, `clientId`, `caseType`, `difficulty` (1–3), `hierarchy` (`HRC|NHRC`),
  `dateHired`, `expectedCompletionDays`, `expectedMailingDate`, `assignedLaUserId`,
  `laManagerUserId`, `attorneyUserId?`, `onboardingLaUserId?`, `onboardingCompletedAt?`,
  `status`, `redFlag` (`none|red_flag_client|red_flag_packet`), `customFields`.
- **Packet** — `id`, `caseId`, `currentStage` (1–12), `stageEnteredAt`, `ownerUserId`,
  `stageHistory[]`, `slaBreached`, `dropboxLink?`.
- **PacketStage** — `index`, `name`, `slaDays`, `startedAt`, `completedAt`, `ownerUserId`.
- **Declaration** — `id`, `caseId`, `currentStage` (1–9), `creativeWriterUserId`, `stageHistory[]`.
- **Task** — `id`, `caseId?`, `type`, `description`, `assigneeUserId`, `dueAt`,
  `status` (`not_started|in_progress|completed`), `createdAt`, `completedAt`.
- **SignOffSheet** — `id`, `packetId`, `stage`, `signedByUserId`, `signedAt`, `fileUrl`.
- **QaChecklist** — `id`, `packetId`, `packetType`, `items[]{label, refLink?, checked}`,
  `submittedByUserId?`, `submittedAt?`.
- **Deadline** — `id`, `caseId`, `kind` (`rfe|noid|denial|abeyance_letter`), `issuedAt?`,
  `dueAt`, `source` (`ocr|manual`), `status`, `respondedAt?`.
- **MedicalRecord** — `id`, `clientName`, `caseId?`, `caseType`, `dueAt?`,
  `status` (`in_office|sent_uscis|awaiting_rfe`), `linkedDeadlineId?`.

## Screens

- `/cases` — case list with case type, stage, owner, SLA/red-flag status, deadlines.
- `/cases/[id]` — case detail: overview, **packet stage tracker**, document checklist (%),
  tasks, declarations, deadlines (RFE/NOID/abeyance), sign-offs, activity/audit.
- `/cases/[id]/qa` — QA checklist (QA Reviewer).
- `/cases/deadlines` — central RFE/NOID/denial deadline tracker.
- `/cases/printing` — File Clerk packet-printing queue (Stage 6+).
- `/cases/medicals` — medical inventory.

## Acceptance criteria

- [ ] A case is created on retention with computed expected mailing date and assignments.
- [ ] The packet advances through stages; an SLA breach red-flags and notifies the chain.
- [ ] Progression past Stage 4 is blocked without the required sign-off sheet.
- [ ] A QA checklist cannot be submitted until all items are checked.
- [ ] An uploaded RFE/NOID produces a tracked deadline with a one-week-prior reminder.
- [ ] Onboarding for a VAWA case omits filing-fee references and uploads the VAWA document set.
- [ ] A mailed packet records mail date + tracking number.
- [ ] Medicals are logged, matched to RFEs, and notify before due dates.

## Out of scope (v1) / future

- Full Docketwise form auto-fill (see [16](16-documents.md)/[21](21-integrations.md)).
- AI-generated declarations (drafting is human; AI assist is future).

## Decisions (v1)

Resolved in [03-architecture-and-scope](03-architecture-and-scope.md):

- **Packet pipelines are fully custom per firm** — each tenant defines its own stages, per-stage
  SLAs, and per-case-type completion timeframes in Settings (the spec's pipeline ships as a
  starter template). The declaration lifecycle is likewise firm-configurable.
- **RFE/NOID/denial due dates are entered manually** in v1 (OCR extraction, UC30, ships with the
  document-AI fast-follow).
- Expected-completion timeframes come from the firm's **case-type catalog** config.
