# 17 · Billing & Payments

> **Module:** `billing` · **Status:** Draft · **Use cases:** UC8, UC9, UC34, UC35, UC36
> **Primary roles:** Accounts Receivable, Admin, Management; File Clerk (status-only)

## Purpose

Invoice clients for consultations, retainers, legal fees, and USCIS filing fees; accept online
payments (single, split, and recurring); track payment plans; and generate revenue, overdue,
and monthly-payment-client reports for firm finance.

## Roles & permissions

| Role | Capability |
|------|-----------|
| AR | Full: invoices, payments, plans, collections, reports. |
| Admin / Management | Full + financial reports & oversight. |
| Sales/CC | Limited: take consultation payments. |
| File Clerk | **Status only** — see whether a client is up to date, never invoice amounts. |

## Use cases

- **UC8 — Consultation Payment**, **UC9 — Split Payment** (see [13](13-consultations-scheduling.md)).
- **UC34 — Automating Revenue Reports.** Pull transactions (date, client — corrected to the
  actual client, case name, invoice # with link, amount, processing fee); classify payment
  type (monthly/full/down/partial-down/partial-full/shipping); identify new-retainer revenue
  tier (HRC/NHRC); consolidate case types; report total revenue per week-of-month, payments per
  case type, distribution per client/case-type/invoice, unique-vs-transaction counts; filter
  unique vs total; export CSV/PDF; notify AR + management on generation.
- **UC35 — Automating Overdue Payment Extraction** (runs the 15th monthly). Pull overdue
  records (invoice/client links, total invoice, paid-so-far, %-paid, remaining, overdue amount,
  months behind); classify (normal collections / termination / packet-not-sent / case-on-hold);
  categorize clients (1mo behind; 2+mo <$1k; 2+mo >$1k); tag payment status; generate report
  to the financial dashboard + notify.
- **UC36 — Monthly Payment Client Tracking** (runs the 1st monthly). Pull active/completed
  monthly-plan clients with full payment detail; identify **drop-offs** (fully paid / withdrawn
  / terminated) with month + final payment date; compute **drop-off rate** = dropped-off ÷ total
  monthly clients × 100; trend report; notify.

## Functional requirements

- **FR-billing-1** — Generate invoices for legal fees, retainers, consultations, and USCIS
  filing fees, each with an invoice number and shareable link.
- **FR-billing-2** — Accept multiple payment methods (credit card, ACH, PayPal, etc.).
- **FR-billing-3** — **Split payments** across multiple cards; **recurring** auto-debit for
  stored cards (with client permission); notify on auto-debit failure.
- **FR-billing-4** — **Payment plans**: installments & due dates; recurring billing; track
  upcoming and missed payments.
- **FR-billing-5** — Identify payment types (down, monthly, full, partial-down, partial-full,
  booked-consultation, shipping).
- **FR-billing-6** — Per-client payment tracking & history; automated reminders for outstanding
  balances; generate overdue items for collections.
- **FR-billing-7** — **Revenue reporting** (UC34) with classification, tiering, consolidation,
  filtering (unique vs total transactions), and CSV/PDF export.
- **FR-billing-8** — **Overdue extraction** (UC35) on the 15th, with classification, client
  bucketing, and status tagging.
- **FR-billing-9** — **Monthly-payment-client tracking** (UC36) on the 1st, with drop-off
  identification and drop-off-rate trend.
- **FR-billing-10** — **Status-only** billing view for File Clerks (up-to-date / behind), never
  amounts (per [02-roles](02-roles-and-permissions.md)).
- **FR-billing-11** — Secure handling of card/financial data; financial reports access-controlled
  & audit-logged (NFR §4.3).

## Data model

- **Invoice** — `id`, `number`, `clientId`, `caseId?`, `lineItems[]`, `total`, `amountPaid`,
  `remaining`, `status` (`draft|sent|partial|paid|overdue|void`), `dueAt`, `link`, `createdAt`.
- **Payment** — `id`, `invoiceId`, `type`, `method`, `amount`, `processingFee?`, `splitGroupId?`,
  `status` (`succeeded|failed|pending`), `cardRef?`, `receiptUrl?`, `paidAt`.
- **PaymentPlan** — `id`, `clientId`, `total`, `retainer`, `monthlyAmount`, `dueDayOfMonth`,
  `startDate`, `durationMonths`, `expectedEndDate`, `includesUscisFees`, `installments[]`.
- **OverdueRecord** — `invoiceId`, `monthsBehind`, `overdueAmount`, `classification`,
  `clientBucket`, `paymentStatusTag`.
- **MonthlyClientStatus** — `clientId`, `monthStatus` (`paid|outstanding`), `overallStatus`
  (`current|overdue|flagged_termination|terminated|payment_arrangement|on_hold|leniency`),
  `dropOff?` (`fully_paid|withdrawn|terminated`), `dropOffMonth?`, `finalPaymentDate?`.

## Screens

- `/billing` — overview: revenue, outstanding, overdue, drop-off rate; financial dashboard.
- `/billing/invoices` — invoice list (create, send, record payment, split, link).
- `/billing/invoices/[id]` — invoice detail with payment history & receipts.
- `/billing/overdue` — overdue report (UC35) with classification & buckets.
- `/billing/monthly` — monthly-payment clients & drop-offs (UC36).
- `/billing/reports` — revenue reports (UC34) with filters & CSV/PDF export.

## Acceptance criteria

- [ ] An invoice can be created, sent, and paid (single, split, recurring) with receipts.
- [ ] Payment plans track installments, due dates, and missed payments.
- [ ] Revenue report classifies payment types and exports CSV/PDF.
- [ ] Overdue report (15th) buckets clients and tags payment status.
- [ ] Monthly-client report (1st) computes drop-off rate and trend.
- [ ] File Clerk sees status only, never invoice amounts.

## Out of scope (v1) / future

- In-app time tracking for billable hours (source marks "future").
- Trust/IOLTA accounting.

## Open questions

- Payment processor(s) and whether card vaulting is processor-hosted (PCI scope).
- Are UC34–36 read from MyCase during migration or native once live? (See [21](21-integrations.md).)
