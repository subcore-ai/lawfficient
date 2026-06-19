# 24 · User Management

> **Module:** `users` · **Status:** Draft · **Use cases:** UC25 (+ UC1 activation) · **Primary roles:** Admin (self-service: All)

## Purpose

The Admin-facing lifecycle for staff accounts: invite a person, let them activate, keep their
role/pod current, and disable them when they leave. This is the operational surface behind the
[role model](02-roles-and-permissions.md) — `02` defines *what* a role can do; this spec defines
*how* an account moves through `invited → active → disabled` and how an Admin drives it.

It complements rather than duplicates two neighbours: [10-authentication](10-authentication.md)
owns the credential mechanics (password, MFA, sessions), and [22-admin-settings](22-admin-settings.md)
owns the broader settings surface (roles editor, templates, integrations, firm settings). This
spec details the user list, the invite flow, and the self-service profile.

## Roles & permissions

| Role | Capability in this module |
|------|---------------------------|
| **Admin** | Full: invite, resend/revoke invites, enable/disable, change role/pod, view all accounts. |
| All other roles | Self-service profile only (own display name, password, MFA); role/pod read-only. |

Account management is Admin-only and **tenant-scoped** — an Admin manages only users within their
own `firm_id` (Supabase RLS, see [03-architecture-and-scope](03-architecture-and-scope.md)).

## Use cases

- **UC25 — User Account Management.** Invite users by email + role; manage roles & pod; enable/
  disable; changes propagate immediately. (Shared with [22-admin-settings](22-admin-settings.md),
  which also covers the role/permission *editor*.)
- **UC1 (activation leg) — Account activation.** An invited user follows the activation link, sets
  a password (and optional MFA), and becomes active. Credential mechanics live in
  [10-authentication](10-authentication.md).

## Functional requirements

- **FR-users-1** — Admin invites a user by **email + one base role**, with optional `isTeamLead` /
  `isManager` flags and an optional **pod**. The system sends an activation email; the user appears
  with status `invited`. (Role shape per [02-roles-and-permissions](02-roles-and-permissions.md).)
- **FR-users-2** — Invitations carry a **single-use, time-limited** activation token. Activating
  sets the user's password (and optional MFA) via [10-authentication](10-authentication.md) and
  moves status `invited → active`.
- **FR-users-3** — Admin can **resend** an invite (issues a fresh token and invalidates the prior
  one) and **revoke** a pending invite (token invalidated; the email can be invited again later).
- **FR-users-4** — Admin can **disable** an active user (`active → disabled`): the user can no
  longer authenticate and **existing sessions are revoked**. Disabling is reversible (`disabled →
  active`).
- **FR-users-5** — Users are **never hard-deleted** in v1 (audit/history retention requires the
  identity to persist). "Remove" means disable. (Aligns with **FR-roles-5**.)
- **FR-users-6** — Admin can change a user's **base role, team-lead/manager flags, and pod**;
  changes **propagate immediately** to authorization (**FR-roles-6**).
- **FR-users-7** — The system **prevents disabling or demoting the last remaining active Admin** in
  a firm, to guard against lock-out.
- **FR-users-8** — Disabling a user surfaces their **open assignments** (case packets, leads, tasks)
  so the Admin can reassign them. v1 does **not block** disable on open work but prompts for
  reassignment. *(See Open questions.)*
- **FR-users-9** — Every user has a self-service **profile**: edit display name, change password and
  manage MFA (via [10-authentication](10-authentication.md)), and view their role/pod read-only.
  **Email and role are Admin-managed**, not self-editable.
- **FR-users-10** — All user-management actions (invite, resend, revoke, enable, disable, role/pod
  change, profile change) are **audit-logged** with actor + IP (**FR-roles-5** / **FR-admin-7**).
- **FR-users-11** — All operations are **tenant-scoped** to the acting Admin's `firm_id` via
  Supabase RLS; cross-firm access is denied server-side, not merely hidden.

## Data model

- **User** — defined in [02-roles-and-permissions](02-roles-and-permissions.md): `id`, `name`,
  `email`, `status` (`invited` / `active` / `disabled`), `roleIds[]` (one base role + flag roles),
  `podId?`, `createdAt`, `lastActiveAt`.
- **Invitation** — `id`, `firmId`, `email`, `roleId`, `isTeamLead`, `isManager`, `podId?`,
  `token` (stored hashed), `invitedByUserId`, `expiresAt`, `acceptedAt?`, `revokedAt?`,
  `status` (`pending` / `accepted` / `revoked` / `expired`).
- **AuditLog** — see [02-roles-and-permissions](02-roles-and-permissions.md).

> **Implementation note:** invites map onto Supabase Auth's invite flow plus a `profiles` row in
> `invited` status; the `Invitation` fields above are the domain view, not a mandate for a separate
> table. Keep the activation hand-off consistent with [10-authentication](10-authentication.md).

## States & transitions

User account status is a small state machine:

```
            invite                 activate
   (none) ─────────▶ invited ───────────────▶ active
                       │                         │
              resend ◀─┤ (new token)             │ disable
              revoke   ▼                         ▼
                    revoked                    disabled
              expire ▼ (TTL)                     │ enable
                    expired                       └────────▶ active
```

- `revoked` and `expired` are pending-invite terminal states; the same email can be **re-invited**
  fresh (a new `Invitation`).
- There is **no hard-delete** transition in v1 (**FR-users-5**).

## Screens

- **`/settings/users`** *(Admin)* — user list: name, email, role (+ lead/manager badges), pod,
  status, last active. Filter by status/role; search by name/email. **Invite** button. Row actions
  are status-aware: `invited` → resend / revoke; `active` → edit, disable; `disabled` → edit, enable.
  Includes empty, loading, and error states.
- **Invite dialog** — email, base-role select, `isTeamLead` / `isManager` toggles, optional pod.
  Validates a well-formed email and rejects an address that is already a member or has a pending
  invite. Confirms the activation email was sent.
- **User detail / drawer** — profile summary, role & pod editor, status controls, an
  **open-assignments** panel for reassignment (**FR-users-8**), and a link to this user's entries in
  the audit log.
- **`/settings/profile`** *(all roles)* — self-service: display name, password & MFA (→
  [10-authentication](10-authentication.md)), read-only role/pod.

The **audit log** is recorded by these actions but **viewed in
[20-reporting-analytics](20-reporting-analytics.md)** (Reporting → Audit log), not here.

## Acceptance criteria

- [ ] Admin invites by email + role; an activation email is sent and the user appears as `invited`.
- [ ] The activation link is single-use and time-limited; using it sets a password and moves the
      user to `active`.
- [ ] Resending an invite invalidates the previous link; revoking a pending invite prevents
      activation.
- [ ] Disabling a user revokes their sessions and blocks login; re-enabling restores access.
- [ ] The **last active Admin** cannot be disabled or demoted.
- [ ] Changing a user's role/pod propagates immediately to what they can access.
- [ ] A user can edit their own display name and manage their password/MFA, but **not** their email
      or role.
- [ ] Every action is audit-logged with actor + IP and is scoped to the acting Admin's firm.

## Out of scope (v1) / future

- Bulk invite / CSV import.
- Hard delete / data-erasure (GDPR-style) workflow — handled via support in v1.
- Avatar / profile-photo uploads.
- Custom **role creation** and granular field-level permissions — see
  [22-admin-settings](22-admin-settings.md) and [02-roles-and-permissions](02-roles-and-permissions.md).
- Per-device session management UI — see [10-authentication](10-authentication.md).
- Auto-disable of dormant accounts based on `lastActiveAt`.

## Open questions

_Resolved for v1 — see **Decisions (v1)** below._ Deferred to later phases:

- Whether expired invites are auto-purged or retained as `expired` history.
- Whether specific assignment types (e.g. an active case packet) should later **block** disable
  rather than only prompt for reassignment.

## Decisions (v1)

Derived from [03-architecture-and-scope](03-architecture-and-scope.md), [02](02-roles-and-permissions.md),
and [10](10-authentication.md):

- Invites are **Supabase Auth** invitations; activation sets a password (+ optional TOTP MFA).
- **One base role per user** plus `isTeamLead` / `isManager` flags and an optional pod.
- **Disable, never hard-delete**, in v1 to preserve audit history.
- **Last-admin lock-out guard** is a hard invariant.
- Tenant isolation by `firm_id` via **RLS**; Admins manage only their own firm.
- Role / permission changes **propagate immediately**.
- **Invite TTL = 7 days**, enforced via the Supabase Auth email-link expiry; **resend** issues a
  fresh link and invalidates the previous one.
- **Disable does not block on open work** — the admin is prompted to reassign the user's open
  packets/leads/tasks, but the disable proceeds (FR-users-8).
- **Disabling revokes sessions immediately** (admin sign-out); the `status = 'active'` gate also
  stops app access on the next request.
- **Email changes are Admin-only and re-verified** — there is no in-place self-service email edit.
