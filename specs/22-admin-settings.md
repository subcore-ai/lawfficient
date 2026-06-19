# 22 · Admin & Settings

> **Module:** `admin` · **Status:** Draft · **Use cases:** UC23, UC24, UC25 · **Primary roles:** Admin

## Purpose

Firm configuration: user & role management, template management (quote letters & engagement
agreements), integration configuration, and firm-level settings. The control plane behind the
[role model](02-roles-and-permissions.md).

## Use cases

- **UC25 — User Account Management.** Invite users by email + role; manage roles & permissions
  (edit/create/delete role — delete only when unassigned); toggle per-module access; changes
  propagate immediately.
- **UC23 — Managing Quote Letter Attachments.** Central store of PDF quote-letter templates;
  upload/remove/update; immediate availability; **delete recovery**.
- **UC24 — Managing Engagement Agreement Templates.** Edit EA templates: §1 intro (static),
  §2 Scope of Services (**conditional by case type**), §3 terms (static); configure §2
  conditional logic; alert if a required section is missing.

## Functional requirements

- **FR-admin-1** — Invite users (email + role); resend/revoke invites; enable/disable users.
- **FR-admin-2** — Manage roles: edit permissions, create role, delete role (only if no users
  assigned); per-module access toggles; immediate propagation.
- **FR-admin-3** — **Quote-letter template** management (upload/replace/remove PDFs) with delete
  recovery and immediate availability (UC23).
- **FR-admin-4** — **Engagement-agreement template** management with static/conditional sections
  and case-type conditional logic; validate required sections before save (UC24).
- **FR-admin-5** — **Integration configuration** ([21-integrations](21-integrations.md)):
  connect/configure/monitor providers; credentials stored encrypted.
- **FR-admin-6** — **Firm settings**: profile, case-type catalog & expected-completion
  timeframes, packet-stage SLAs, consultation types/prices, notification defaults (as far as
  these are configurable — see open questions).
- **FR-admin-7** — All admin actions are **audit-logged** (NFR §4.3), including deletions with
  user + IP.
- **FR-admin-8** — **Packet pipeline editor**: add, rename, reorder, and remove packet stages and
  set each stage's SLA (turnaround days), with a total expected-turnaround readout. v1 edits a
  single **firm-wide** pipeline (the default); a **per-case-type** override layer is planned.
  Admin-only; changes apply live to the stage tracker, cases list, and printing queue.

## Data model

- **User**, **Role**, **Pod** — see [02-roles-and-permissions](02-roles-and-permissions.md).
- **Template** — see [14-retention-engagement](14-retention-engagement.md) (`kind`, `sections`/
  `file`, `conditionalRules`, `isActive`, `archivedAt`).
- **FirmSettings** — `id`, `name`, `caseTypes[]{name, expectedCompletionDays, requiresFilingFee,
  requiresDeclaration}`, `packetPipeline[]{id, name, slaDays}` (firm-wide; per-case-type override
  map planned), `consultationTypes[]{name, price, paid}`,
  `notificationDefaults`.
- **AuditLog** — see [02-roles-and-permissions](02-roles-and-permissions.md).

## Screens

- `/settings` — settings home (firm profile, navigation to sub-sections).
- `/settings/users` — user list, invite, enable/disable. Detailed in [24-user-management](24-user-management.md).
- `/settings/roles` — role list, permission editor, create/delete.
- `/settings/templates` — quote-letter & EA template management.
- `/settings/integrations` — provider configuration ([21](21-integrations.md)).
- `/settings/case-types` — case-type catalog, SLAs, timeframes.
- `/settings/pipeline` — firm-wide packet stages & per-stage SLAs (per-case-type override planned).

The **audit log** is recorded by these admin actions but **viewed in
[20-reporting](20-reporting-analytics.md)** (Reporting → Audit log tab), not under Settings.

## Acceptance criteria

- [ ] Admin invites a user by email + role; the invite is sent and the user can activate.
- [ ] A role's permissions can be edited and propagate immediately; an assigned role can't be deleted.
- [ ] Quote-letter PDFs can be uploaded/replaced/removed; a deleted template is recoverable.
- [ ] EA templates edit static §1/§3 and conditional §2 (by case type); save blocks on a missing
      required section.
- [ ] Integrations can be connected/monitored; credentials are encrypted.
- [ ] Every admin action (incl. deletes) is audit-logged with user + IP.
- [ ] An admin can add/rename/reorder/remove packet stages and set per-stage SLAs; the case stage
      tracker, cases list, and printing queue reflect the change immediately.

## Out of scope (v1) / future

- Self-serve firm onboarding/billing (SaaS signup) for multi-tenant.
- Granular field-level permission editor (start at module level).

## Decisions (v1)

Resolved in [03-architecture-and-scope](03-architecture-and-scope.md):

- **Firm-configurable** (per tenant, with seeded defaults): packet pipelines & SLAs, case-type
  catalog & timeframes, consultation types & prices, cancellation policy, notification defaults,
  quiet hours, and templates.
- **Packet pipeline rollout:** v1 ships a single **firm-wide** editable pipeline (ordered stages
  + per-stage SLA days); **per-case-type pipelines** layer on later, inheriting the firm-wide
  pipeline as the **default**.
- **Templates/settings are per-firm** with platform starter defaults.
- **Template editing:** PDF upload for quote letters; structured sectioned editor for engagement
  agreements (see [14-retention-engagement](14-retention-engagement.md)).
