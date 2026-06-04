# 03 · Architecture & v1 Scope (Decisions)

> **Status:** Decided (2026-06-04 review) · Supersedes the per-module "Open questions".
> This is the authoritative record of the cross-cutting decisions. Module specs reference it.

## Tenancy & isolation

- **Multi-tenant SaaS**; the **tenant is a law firm**. One deployment serves many firms.
- **Row-level isolation by `firm_id`**, enforced with **Supabase Row Level Security (RLS)** —
  every tenant-owned table carries `firm_id` and policies key off the authenticated user's firm.
- Firm is resolved at sign-in from the user's profile (`profiles.firm_id`); subdomain/org-based
  routing is a later enhancement.

## Technology stack

| Concern | Choice |
|--------|--------|
| Framework | Next.js 16 (App Router) in a Turborepo (`apps/app`, `@workspace/ui`) |
| UI | shadcn/ui on Base UI (`base-nova`), Tailwind v4 — already built |
| Database | **Supabase Postgres** |
| Auth | **Supabase Auth** (email/password; TOTP MFA available) |
| File storage | **Supabase Storage** (per-firm buckets/prefixes) |
| Payments | **Stripe** |
| SMS | **Twilio** |
| Email | **Resend** |
| Hosting | Vercel (app) + Supabase (data/auth/storage) |

ORM/data-access: Supabase client + typed schema (Drizzle optional for migrations) — TBD at
implementation, not blocking.

## Auth & roles

- **Supabase Auth**; **MFA optional** for all roles (not enforced in v1).
- **Role model:** each user has **one base role** (Admin, Attorney, Legal Assistant, QA, Creative
  Writer, Sales & Client Care, Accounts Receivable, File Clerk) **plus optional flags**:
  - `isTeamLead` → pod-wide visibility over their team's work + escalations.
  - `isManager` → firm-wide oversight, red-flag/escalation alerts, performance & financial reports.
- "QA Team Lead", "Legal Assistant Team Lead", "Creative Writers' Team Lead" = base role +
  `isTeamLead`. "Management" = `isManager`. See [02-roles-and-permissions](02-roles-and-permissions.md).
- Authorization is enforced server-side and at the data layer (RLS), not just hidden in the UI.

## Payments (Stripe)

- Cards + ACH; **card vaulting** for recurring auto-debit (with client permission).
- **Payment plans** → Stripe subscriptions/invoices with installment due dates.
- **Split payments** → multiple PaymentIntents under one logical charge.
- Stripe webhooks drive payment status, receipts, and overdue/missed-payment tracking.

## Messaging (Twilio + Resend)

- **Twilio** for SMS; **Resend** for transactional email. In-app notifications stored natively.
- Honors client communication preferences; respects quiet hours (default: 8am–8pm client-local;
  firm-configurable).

## Documents

- **Supabase Storage** is the system of record in v1 (per-firm isolation). Dropbox sync is a
  fast-follow. Versioning via Storage + a `document_versions` table; retention policy
  firm-configurable (default: keep all versions).

## v1 scope

**In v1 (build natively):**

- Auth, RBAC, multi-tenant isolation.
- Dashboard, Leads & CRM, Consultations & scheduling (manual booking), Retention (quotes + EAs,
  signed out-of-band), Case management (packet stages, deadlines, declarations, QA, onboarding),
  Documents (Supabase Storage), Billing & payments (Stripe), Reporting (fixed catalog on native
  data), Communications (Twilio/Resend, in-app), Admin & settings.
- Mobile-responsive web (already inherent in the UI).

**Fast-follow (not v1):**

- **Integrations:** RingCentral (telephony/caller-ID), MyCase migration, Docketwise + Jotforms
  (USCIS form prep), USCIS status lookup, Dropbox sync.
- **E-signature** for engagement agreements (generated in v1, signed out-of-band).
- **Client portal** (specified in [18-client-portal](18-client-portal.md)).
- **Scheduling:** attorney availability rules + Google/Outlook two-way sync.
- **Lead assignment:** automatic round-robin / load-balancing (manual in v1).

**Deferred (later):** time tracking (billable hours), AI assistance (drafting/summarizing),
custom/ad-hoc report builder.

## Per-firm configurability

Tenants configure (with seeded starter defaults where noted), via Admin → Settings:

- **Packet pipelines**: stages, per-stage SLAs, and per-case-type completion timeframes —
  **fully custom per firm** (not a fixed shared pipeline).
- **Case-type catalog** (names, filing-fee applicability, declaration requirement, timeframes).
- **Consultation types & prices**.
- **Cancellation policy** (fee on/off & amount, rebooking/approval limits) — **per tenant**.
- **Templates** (quote letters, engagement agreements), roles, and notification defaults.

## Impacts on the manual ("not yet automated") flows in v1

Because the integrations are deferred, these spec flows are **manual in v1**:

- Caller identification / call disposition (UC2, UC6) → staff create/select records manually.
- Monthly client updates (UC26) → status entered manually; templated send via Twilio/Resend.
- USCIS form prep (UC37, 39, 41) → handled outside the platform; documents uploaded back.
- RFE/NOID deadline extraction (UC30) → due dates entered manually (no OCR in v1).
- MyCase data → entered natively or imported when the migration ships.

## Residual decisions (proposed defaults — confirm when convenient)

- Required lead fields at first capture: **first name, last name, and phone or email**; the rest
  enriched later.
- Duplicate detection: flag on close match of **name + DOB + nationality**; never auto-merge.
- Dashboard: fixed widget catalog per role in v1 (drag-to-customize is a later enhancement);
  global time-range control (Today / 7d / 30d / custom).
- Reporting: defined catalog; financial reports (revenue/overdue/monthly) generated on a schedule
  (1st & 15th per spec) plus on-demand; computed from native data.
- Template editing: PDF upload for quote letters; structured sectioned editor for engagement
  agreements (static §1/§3 + conditional §2 by case type).
- Audit-log retention: **2 years** default (firm-configurable); trust/IOLTA accounting out of scope.
