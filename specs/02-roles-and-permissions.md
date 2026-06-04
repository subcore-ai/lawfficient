# 02 · Roles & Permissions

> **Status:** Draft · **Source:** §2.1 User Roles, UC1 (login), UC25 (user account mgmt)
> **Primary roles:** Admin

## Purpose

Lawfficient is **role-based**. Every feature is gated by role, and access control is a
non-functional requirement (encrypt sensitive data, audit critical actions). This spec is the
single source of truth for the role model; module specs reference it.

## Roles

The source defines nine roles. Several imply sub-roles/leads, captured as variants.

| # | Role | Core responsibilities |
|---|------|------------------------|
| 1 | **Admin** | Full access to all features; manage users, roles, and templates. |
| 2 | **Attorney** | Access consultation calendar; add consultation notes; review packets (document-review & office attorney); determine case qualification & hierarchy; address RFEs/NOIDs. |
| 3 | **Legal Assistant Team Lead** | Manage client case packets; track packet stages; coordinate document gathering & client updates; receive/send task endorsements; **monitor packets of LAs in their pod**; send quote letters. |
| 4 | **Legal Assistant (LA)** | Manage packets; track stages; coordinate docs & client updates; receive/send endorsements; send quote letters; client onboarding & monthly updates. |
| 5 | **Quality Assurance Team Lead** | Receive/send endorsements from LAs & creative writers; monitor sign-off sheet of corrections; run packet review checklists. |
| 6 | **Creative Writer** | Draft declarations; receive/send endorsements; monitor sign-off sheet. (Has a **Creative Writers' Team Lead** who assigns intake meetings.) |
| 7 | **Sales & Client Care Staff** | Enter new leads; schedule paid/unpaid consultations; access qualified-consultation DB for follow-up; **dispose each call** (new lead vs existing client). |
| 8 | **Accounts Receivable (AR) Staff** | Create invoices (legal fees / USCIS filing fees); send quote letters; **convert lead to client & provision portal access**; manage payment plans & overdue collections. |
| 9 | **File Clerk Staff** | Send messages to clients & upload documents; process inbound mail; **see payment _status_ only** (not full invoice amounts). Has a **FileClerk Team Lead** who assigns printing tasks. |

Additional actors referenced by use cases:

- **QA Reviewer** — performs packet reviews under the QA Team Lead.
- **Management / Firm Management** — oversight; receives escalations, red-flag alerts, and
  performance/financial reports (not an operational role but a permission tier).
- **System** — automated processes (notifications, extraction, lookups).
- **Client** — external; uses the [Client Portal](18-client-portal.md), not the staff platform.

## Permission matrix (staff platform)

Levels: **F** full · **E** edit · **V** view · **L** limited/conditional · **—** none.
Indicative starting point; refined per-module.

| Module | Admin | Attorney | LA Lead | LA | QA Lead | Creative | Sales/CC | AR | File Clerk |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Dashboard | F | V | V | V | V | V | V | V | V |
| Leads & CRM | F | V | V | L | — | — | **F** | E | — |
| Consultations | F | E | V | V | — | — | **F** | E | — |
| Retention (quotes/EA) | F | E | E | E | — | — | L | **E** | — |
| Case Management | F | E | **F** | E | E | E | — | — | L |
| Documents | F | E | E | E | E | E | — | — | **E** |
| Billing & Payments | F | V | — | — | — | — | L | **F** | **L (status only)** |
| Reporting | F | V | V | L | V | — | L | E | — |
| Admin & Settings | **F** | — | — | — | — | — | — | — | — |

> File Clerk billing access is intentionally **status-only** (e.g. "up to date" / "behind"),
> never full invoice amounts (source §2.1.9).

## Functional requirements

- **FR-roles-1** — Authentication gates all access (see [10-authentication](10-authentication.md)).
- **FR-roles-2** — Every route and action is authorized against the acting user's role(s);
  unauthorized access is denied (not just hidden).
- **FR-roles-3** — Admin can invite users by email with a role, edit role permissions, create
  roles, and delete roles **only when no users are assigned** (UC25).
- **FR-roles-4** — A user may hold a **team-lead** variant that grants pod-wide visibility over
  their team's work and escalations.
- **FR-roles-5** — All critical actions are **audit-logged** with user identity and IP,
  including deletions (source §2.2.10).
- **FR-roles-6** — Role changes propagate across the system immediately (UC25 postcondition).

## Data model

- **User** — `id`, `name`, `email`, `status` (invited/active/disabled), `roleIds[]`, `podId?`,
  `createdAt`, `lastActiveAt`.
- **Role** — `id`, `name`, `permissions` (per-module access map), `isSystem` (predefined).
- **Pod / Team** — `id`, `name`, `leadUserId`, `memberUserIds[]`.
- **AuditLog** — `id`, `actorUserId`, `action`, `entity`, `entityId`, `ip`, `at`, `before/after`.

## Screens

- `/settings/users` — user list, invite, enable/disable. (Admin)
- `/settings/roles` — role list, edit permissions, create/delete role. (Admin)
- Detailed in [22-admin-settings](22-admin-settings.md).

## Acceptance criteria

- [ ] A user only sees navigation and actions permitted by their role.
- [ ] Server-side authorization rejects unpermitted actions even if the UI is bypassed.
- [ ] Admin can invite a user, assign a role, and the invite email is sent.
- [ ] A role with assigned users cannot be deleted.
- [ ] File Clerk sees payment status but never invoice amounts.

## Decisions (v1)

Resolved in [03-architecture-and-scope](03-architecture-and-scope.md):

- **One base role per user** plus optional `isTeamLead` (pod visibility) and `isManager`
  (firm-wide oversight) flags. The "… Team Lead" roles = base role + `isTeamLead`; "Management" =
  `isManager`.
- The permission matrix above is the **v1 baseline**; Admins can edit role permissions (UC25).
- Authorization is enforced server-side and via **Supabase RLS** (tenant isolation by `firm_id`).
