# 19 · Communications & Notifications

> **Module:** `communications` · **Status:** Draft · **Use cases:** UC26, UC42 (3-pronged), UC44
> **Primary roles:** Legal Assistant(s), System, Team Leads, Management

## Purpose

The notification and outbound-communication backbone: automated email/SMS/in-app messages,
reminders, monthly client updates, the three-pronged follow-up process, and task routing for
ongoing client requests. Many other modules emit through this one.

## Roles & permissions

| Role | Capability |
|------|-----------|
| System | Generate notifications, reminders, monthly updates, escalations. |
| Legal Assistant | Run the 3-pronged follow-up; own routed monthly-update tasks. |
| Team Lead / Management | Receive escalations; view task performance reports. |

## Use cases

- **UC26 — Automating Monthly Client Updates.** File Clerk uploads a receipt notice → system
  reads the receipt number → automatic USCIS status lookup → populate a monthly-update template
  → send via **SMS + portal** simultaneously → log & mark complete → stop updates if case
  withdrawn/terminated/closed; alert on receipt-number or lookup failure.
- **UC42 — Three-Pronged Client Follow-Up.** For document-gathering stages (1, 3, 5, 8), the LA
  contacts the client via **portal message + text + phone call**; discusses pending docs,
  supplemental questions, commitment dates; writes a **call summary**; sends the summary as a
  portal message **and** a text (consistent across all three); repeats as needed; failure to
  complete all three prongs is reviewable by management.
- **UC44 — Automatic Task Routing to Assigned LA (Monthly-Update Clients).** When a client has
  an assigned monthly-updates LA, **all future admin requests** (EAD renewal, address change,
  general follow-ups) route to that same LA as a tracked task; reminders before due; escalation
  to Team Lead if overdue; reassignment transfers active/pending tasks; weekly performance
  reports to management.

## Functional requirements

- **FR-comms-1** — **Automated email & in-app notifications** for follow-ups and reminders.
- **FR-comms-2** — **SMS notifications** for critical updates.
- **FR-comms-3** — **Customizable notification settings** per user.
- **FR-comms-4** — **System-generated alerts** for: upcoming consultations, payment due dates,
  case updates, missing documents/required actions (source §2.2.8).
- **FR-comms-5** — **Monthly client updates** automated from receipt-number USCIS lookups, sent
  via SMS + portal, with stop conditions and failure alerts (UC26).
- **FR-comms-6** — **Three-pronged follow-up** support: initiate portal+text+call, capture a
  call summary, and send it consistently via portal + text (UC42).
- **FR-comms-7** — **Task routing** of ongoing client requests to the assigned monthly-updates
  LA, with status tracking, reminders, overdue escalation, and reassignment transfer (UC44).
- **FR-comms-8** — Honor client **communication preferences** (email/SMS/phone) from the
  [portal](18-client-portal.md).
- **FR-comms-9** — Notifications are logged for audit/reference; failures are logged & surfaced.
- **FR-comms-10** — Message templates per channel, personalized with client/case fields, and
  case-type-aware (e.g. omit filing-fee references for VAWA).

## Data model

- **Notification** — `id`, `recipient` (`userId`/`clientId`), `channel` (`email|sms|in_app|
  portal`), `kind`, `templateId?`, `payload`, `status` (`queued|sent|failed`), `sentAt`, `error?`.
- **NotificationSetting** — `userId`, `kind`, `channels[]`, `enabled`.
- **MonthlyUpdate** — `id`, `clientId`, `caseId`, `receiptNumber`, `uscisStatus`, `sentVia[]`,
  `sentAt`, `stoppedReason?`.
- **FollowUpRecord** — `id`, `caseId`, `stage`, `channelsUsed[]`, `callSummary`, `byUserId`, `at`.
- **RoutedTask** — see **Task** in [15-case-management](15-case-management.md), with
  `routedToUserId` = client's monthly-updates LA.

## Screens

- `/communications` — notification/activity center: queued/sent/failed, per-kind filters.
- `/communications/follow-ups` — three-pronged follow-up queue & call-summary composer.
- `/communications/tasks` — routed monthly-update tasks (status, due, overdue, escalations).
- `/settings/notifications` — per-user notification preferences.

## Acceptance criteria

- [ ] Upcoming consultations, payment due dates, missing docs, and case updates emit alerts.
- [ ] A monthly update is generated from a receipt lookup and sent via SMS + portal; updates
      stop for withdrawn/terminated/closed cases.
- [ ] The three-pronged follow-up records a call summary sent identically via portal + text.
- [ ] Requests for a monthly-update client route to the assigned LA, with overdue escalation.
- [ ] Users can customize which channels they receive for each notification kind.

## Out of scope (v1) / future

- Marketing campaign automation (broadcast nurture sequences).
- AI-drafted client replies (beyond simple auto-responses in the portal).

## Decisions (v1)

Resolved in [03-architecture-and-scope](03-architecture-and-scope.md):

- **SMS via Twilio, email via Resend**; in-app notifications stored natively.
- **Monthly client updates (UC26) are manual in v1** — status is entered by staff and sent via a
  template (Twilio/Resend); automated USCIS status lookup is fast-follow.
- **Quiet hours** default to 8am–8pm client-local for SMS, **firm-configurable**.
