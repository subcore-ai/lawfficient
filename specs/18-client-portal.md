# 18 · Client Portal

> **Module:** `portal` · **Status:** Draft (built in a later pass) · **Use cases:** UC27, UC38, UC42
> **Primary roles:** Client (external), Legal Assistant(s)

## Purpose

The client-facing surface: secure messaging with the firm, document upload & access, case-
status visibility, and payment history. Distinct from the staff platform; clients only see
their own case. The staff platform is built first; this spec defines the portal for a later pass.

## Roles & permissions

| Role | Capability |
|------|-----------|
| Client | View own case status & timeline; upload requested documents; message the firm; view payment history & invoices; submit callback/urgent requests; set communication preferences. |
| Legal Assistant | Respond to messages/requests; share checklists; send updates. |

## Use cases

- **UC27 — Track & Prioritize Client Requests.** Portal scans incoming requests (messages &
  callbacks), categorizes by priority (urgent/high/normal), notifies LAs of high-priority items,
  sends end-of-day reminders for pending requests, generates outstanding-request reports;
  escalates missed messages/callbacks to management.
- **UC38 — Monitor & Respond to Message-Back Requests.** Periodically check portal messages;
  flag new ones; analyze content (straightforward vs complex); auto-respond to simple ones;
  escalate complex ones to an LA queue; tag callback requests; flag urgent/time-sensitive as
  high priority.
- **UC42 — Automate Callback Request Handling.** Detect callback requests; compute the
  appropriate callback window; prioritize urgent ones; schedule on the LA calendar with
  reminders; LA logs notes after the call; auto-reschedule missed callbacks within 24–48h;
  escalate overdue ones.

## Functional requirements

- **FR-portal-1** — Secure client authentication (provisioned at retention by AR).
- **FR-portal-2** — Secure **messaging** between client and firm, with read/unread state.
- **FR-portal-3** — **Document upload & access** scoped to the client's own case, with a
  requested-documents checklist and progress.
- **FR-portal-4** — **Case status & timeline** visibility (key deadlines, milestones).
- **FR-portal-5** — **Payment history & invoice access** (status, receipts).
- **FR-portal-6** — **Request prioritization**: classify incoming messages/callbacks by
  priority; auto-respond to simple messages; escalate complex/urgent to LAs.
- **FR-portal-7** — **Callback scheduling** with reminders, auto-reschedule (24–48h), and
  overdue escalation.
- **FR-portal-8** — Client **communication preferences** (email / SMS / phone) honored across
  the system (see [19-communications](19-communications-notifications.md)).
- **FR-portal-9** — Outstanding-request reporting and management escalation for missed items.

## Data model

- **PortalUser** — `id`, `clientId`, `email`, `status`, `commsPreference`.
- **Message** — `id`, `clientId`, `from` (`client|firm|system`), `body`, `priority`
  (`urgent|high|normal`), `category`, `status` (`new|auto_responded|escalated|resolved`),
  `assignedLaUserId?`, `createdAt`.
- **CallbackRequest** — `id`, `clientId`, `requestedWindow?`, `status` (`pending|scheduled|
  completed|missed|escalated`), `scheduledAt?`, `assignedLaUserId?`, `notes?`.

## Screens (portal app — later pass)

- `/portal` — client dashboard: case status, next steps, alerts.
- `/portal/documents` — requested-documents checklist + upload + access.
- `/portal/messages` — secure messaging; callback request.
- `/portal/billing` — invoices, payment history, pay now.
- `/portal/settings` — communication preferences.

Staff-side counterparts live in [19-communications](19-communications-notifications.md) and the
case workspace.

## Acceptance criteria

- [ ] A retained client can log in and see only their own case.
- [ ] A client can upload requested documents and message the firm.
- [ ] Incoming requests are prioritized; simple messages auto-respond; complex escalate to an LA.
- [ ] Callback requests are scheduled, reminded, and auto-rescheduled if missed.
- [ ] Communication preferences are honored.

## Out of scope (v1) / future

- Native mobile app (mobile-friendly web first).
- Client-to-client or multi-party case access.

## Open questions

- Is the portal a separate Next.js app (`apps/portal`) or role-gated routes within `apps/app`?
- Reuse of MyCase portal during migration vs. native portal at launch.
- Auto-response policy and guardrails (what may the system answer without an LA?).
