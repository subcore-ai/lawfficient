# 13 · Consultations & Scheduling

> **Module:** `consultations` · **Status:** Draft · **Use cases:** UC4, UC8, UC9, UC10, UC11, UC12, UC13
> **Primary roles:** Sales & Client Care Staff, Attorneys

## Purpose

Book paid and unpaid consultations against attorney calendars, take payment (including split
payments), manage reschedules/cancellations with notifications, and capture attorney
consultation notes that drive qualification and retention.

## Roles & permissions

| Role | Capability |
|------|-----------|
| Sales & Client Care | Book, reschedule, cancel, take payment, resend confirmations. |
| Attorney | View calendar; add consultation notes; set qualification. |
| AR / All | Process consultation & split payments (UC8, UC9). |

## Use cases

- **UC4 — Booking a Consultation.** Click "Book Consultation" → attorney calendar →
  appointment type → time zone → enter lead details (name, phone, email, notes, language,
  referral source, country of origin, current city, state, zip, gender, DOB, case hierarchy,
  case type) → Schedule Appointment → Save. Appointment appears on the attorney's calendar.
- **UC8 — Processing Consultation Payment.** Open appointment → Make Payment → new/saved card →
  Pay → verify & record → confirmation + auto receipt to client. Handle declines/gateway down.
- **UC9 — Processing Split Payments.** Charge across two cards (amount on card 1 +
  remaining on card 2), each processed separately; partial-failure handling.
- **UC10 — Rescheduling.** Open → Reschedule → (custom) pick attorney calendar + new date/time
  → confirm → notify client + attorney. Error if calendar unavailable.
- **UC11 — Sending a Confirmation Email.** "Yes, Resend Confirmation" → generate & send →
  success message; error if email missing/invalid or send fails (logged).
- **UC12 — Canceling an Appointment.** Open → Cancel → confirm → status `Canceled`, removed
  from calendar, notify parties. Block cancel if already completed; prompt for fee if applicable.
- **UC12b — Canceling a Paid Consultation (cancellation limits).** Tracks per-lead cancellation
  count; **3rd cancellation blocks re-booking without admin approval**; increments counter;
  notify client/attorney/staff.
- **UC13 — Adding Consultation Notes.** Open consultation form → auto-fill name/email →
  determine qualification (Yes / No / future-hire date) → assign staff for follow-up (code
  letter) → select case type → enter notes → submit; assignee notified to send the code letter.

## Functional requirements

- **FR-consult-1** — Book multiple consultation types (paid and unpaid).
- **FR-consult-2** — Booking captures time zone for date/time accuracy.
- **FR-consult-3** — Appointments render on the assigned attorney's calendar.
- **FR-consult-4** — Process payments via multiple methods; record outcome; auto-generate &
  send a receipt.
- **FR-consult-5** — Split a single consultation charge across multiple cards, processed
  independently with partial-failure recovery.
- **FR-consult-6** — Reschedule against attorney availability with notifications to client +
  attorney; block on unavailable calendar.
- **FR-consult-7** — Resend confirmation email on demand; validate email; log send failures.
- **FR-consult-8** — Cancel with confirmation, status update, calendar removal, notifications;
  block cancellation of completed appointments; prompt for cancellation fee when applicable.
- **FR-consult-9** — Enforce **cancellation limits**: track count per lead; 3rd cancellation
  requires admin approval before re-booking.
- **FR-consult-10** — Attorney consultation notes with qualification outcome (qualified now /
  not qualified / future-hire date), case type, and follow-up assignee.
- **FR-consult-11** — Auto-reminders for upcoming consultations (email + SMS); track outcome &
  next steps (see [19-communications](19-communications-notifications.md)).
- **FR-consult-12** — Send quotes / battery charts for qualified consultations (hands to
  [14-retention-engagement](14-retention-engagement.md)).

## Data model

- **Consultation** — `id`, `leadId`, `attorneyUserId`, `type` (`paid|unpaid`, named types),
  `status` (`scheduled|paid|completed|rescheduled|canceled|no_show`), `startAt`, `endAt`,
  `timeZone`, `bookedByUserId`, `caseType?`, `createdAt`.
- **ConsultationNote** — `id`, `consultationId`, `qualification` (`qualified|not_qualified|
  future_hire`), `futureHireDate?`, `caseType`, `followUpAssigneeUserId`, `body`, `byUserId`, `at`.
- **Payment** — see [17-billing-payments](17-billing-payments.md) (`type`, `amount`,
  `method`, `splitGroupId?`, `status`, `receiptUrl?`).
- **CancellationCounter** — `leadId`, `count`, `lastCanceledAt`, `requiresAdminApproval`.

## Screens

- `/consultations` — calendar + list with status filters; "Book consultation".
- Booking dialog — attorney, type, time zone, date/time, lead details (UC4).
- `/consultations/[id]` — detail: status, payment (Make Payment / split / receipt),
  reschedule, cancel, resend confirmation, **attorney notes** tab (UC13).

## Acceptance criteria

- [ ] A consultation can be booked against an attorney calendar with a time zone.
- [ ] A payment processes, records, and emails a receipt; declines are handled.
- [ ] A charge can be split across two cards with independent success/failure.
- [ ] Reschedule and cancel update status, calendar, and notify parties.
- [ ] A 3rd cancellation blocks re-booking pending admin approval.
- [ ] Attorney notes capture qualification, case type, and follow-up assignee; assignee is notified.

## Availability & calendar (scheduling — promoted from fast-follow)

The shipped v1 books a manual date/time. This adds per-attorney **office hours** (Calendly-style) and a
**calendar**, so a consult is booked into a free slot inside an attorney's availability and never
double-booked.

### Data model

- **`profiles.schedulable`** (`boolean`) — who takes consultations (seeded `true` for `role='attorney'`;
  a firm may mark any staff schedulable, keeping it multi-practice).
- **AttorneyAvailability** — recurring weekly office hours: `firmId`, `attorneyId`, `weekday` (0–6),
  `startTime`, `endTime`, `data jsonb`. Multiple rows per day (split shifts). Stored in the firm tz.
- **AvailabilityException** *(Phase 5)* — time-off / holidays / one-off extra hours: `attorneyId`,
  `startAt`, `endAt`, `kind (block|extra)`, `reason`.
- **No double-booking** — a Postgres exclusion constraint (`btree_gist`) on `consultations`: no two
  non-canceled consults for the same attorney whose `[start, start+duration)` ranges overlap. Race-proof
  at the DB, where an app-level check can't be.
- Slot config (interval, buffer, min-notice, max-advance) is firm/attorney **config**; the slot duration
  comes from the consult type.

### Slot engine

Pure, unit-tested `generateSlots({ windows, existingConsults, date, slotMinutes, buffer, now })`: expand
the weekday's windows → drop slots overlapping a booked consult (+ buffer) → drop past/too-soon → the
remainder is bookable. Booking goes through `createConsultation`, now validated server-side against
availability + the overlap constraint.

### Calendar UI

- `/consultations`: a **Calendar / List** toggle (List = the shipped status board).
- **Day, multi-attorney columns** — pick 1–N schedulable attorneys (default ~3), each a column; office
  hours shaded, booked consults as blocks, free slots click-to-book (pre-fills attorney + start + duration).
- **Week** — single attorney, 7-day grid. Reschedule reuses the slot picker.

### Timezone

v1 renders in the **firm timezone** (`firms.timezone`); cross-tz / remote attorneys are later. The
per-consult UTC instant + `timeZone` are stored as today.

### Phasing

1. Availability model + Settings "Office hours" editor (per attorney). **← this PR**
2. Slot engine + the exclusion-constraint guard + server-side booking validation.
3. Calendar UI — single attorney.
4. Multi-attorney day view.
5. Exceptions + booking rules (buffer / min-notice / max-advance).

### Locked decisions

- Bookable = `schedulable` flag, seeded from `role='attorney'`.
- Firm-single-tz for v1.
- Slot duration from the consult type + a configurable interval.
- Double-booking prevented by a DB exclusion constraint.
- Office hours are **admin-managed** (`settings.manage`, Settings → Office hours) **and self-service** — an attorney edits their own from their profile (RLS allows the owner, `attorney_id = auth.uid()`). Read on `consultations.view` / `settings.manage` / owner.
- No public self-service booking page in v1 (the client portal stays deferred — [18-client-portal](18-client-portal.md)).

## Out of scope (v1) / future

- Public self-service client booking page.
- Round-the-clock availability sync to external calendars (Google/Outlook two-way).

## Decisions (v1)

Resolved in [03-architecture-and-scope](03-architecture-and-scope.md):

- **Scheduling:** manual date/time booking with time zone shipped in v1. Per-attorney availability
  rules + the calendar are now being built (see "Availability & calendar" above); Google/Outlook
  two-way sync remains fast-follow.
- **Cancellation policy is per-tenant** (fee on/off & amount, rebooking/approval limits),
  configured in Settings; the 3-cancellation approval gate (UC12b) is the default behavior.
- **Consultation types and prices are firm-configurable** (seeded defaults), set in Settings.
- Payments via Stripe (see [17-billing-payments](17-billing-payments.md)).
