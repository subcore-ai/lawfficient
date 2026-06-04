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

## Out of scope (v1) / future

- Public self-service client booking page.
- Round-the-clock availability sync to external calendars.

## Open questions

- Calendar source of truth: internal availability or external calendar sync?
- Cancellation-fee amounts/policy and which appointment types incur them.
- Exact named consultation types and their prices.
