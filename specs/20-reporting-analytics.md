# 20 · Reporting & Analytics

> **Module:** `reporting` · **Status:** Draft · **Source:** Feature §2.2.7; UC34–36, UC43
> **Primary roles:** Management, Admin, Accounts Receivable, Team Leads

## Purpose

Give the firm visibility into performance, finances, and case trends through customizable,
filterable, exportable reports — drawing on data produced across all modules.

## Roles & permissions

| Role | Capability |
|------|-----------|
| Management / Admin | All reports, firm-wide. |
| AR | Financial reports (revenue, overdue, monthly clients). |
| Team Leads | Pod/team performance reports. |
| Attorney / Sales | Their own conversion/productivity slices. |

## Use cases & report catalog

- **Lead conversion rates** (per attorney, per sales agent) — from [12-leads](12-leads-crm.md), UC43.
- **Number of qualified consultations**; booked-&-paid; consultation trends — UC43, [13](13-consultations-scheduling.md).
- **Agent productivity** (booked & paid consultations, qualified leads) — UC43.
- **Payment & revenue reports** (UC34) — total revenue per week-of-month, payments per case
  type, distribution per client/case-type/invoice, unique vs transaction counts.
- **Overdue payment report** (UC35) and **monthly-payment-client / drop-off report** (UC36).
- **Case stages timeline**; **turnaround exceedance**, **on-time completion**, **red-flag
  summary** (UC17) — from [15-case-management](15-case-management.md).
- **Results Received Report** (approvals/RFEs by type) — from [16-documents](16-documents.md).
- **Task performance** (per LA/client, overdue) — from [19-communications](19-communications-notifications.md), UC44.

## Functional requirements

- **FR-reporting-1** — Customizable reporting with **filters**: date range, attorney, lead
  source, case type, agent, etc.
- **FR-reporting-2** — **Export** to PDF and Excel/CSV.
- **FR-reporting-3** — **Data visualization**: graphs, charts, trend analysis.
- **FR-reporting-4** — Generate the report catalog above; each report has a canonical
  definition and consistent case-type categorization.
- **FR-reporting-5** — **Notifications** when scheduled reports (revenue UC34 / overdue UC35 /
  monthly UC36) are generated, to AR + management.
- **FR-reporting-6** — Reports respect role scope (a user only sees data they're permitted to).
- **FR-reporting-7** — Surface key reports as **dashboard** widgets ([11-dashboard](11-dashboard.md)).

## Data model

- **ReportDefinition** — `id`, `key`, `title`, `filters[]`, `visualization`, `roleScope[]`.
- **ReportRun** — `id`, `definitionId`, `params`, `generatedAt`, `generatedByUserId|system`,
  `exportUrls{pdf,csv}`.
- Reads from module entities; owns no business data.

## Screens

- `/reporting` — report catalog with filters and saved views.
- `/reporting/[key]` — a report: chart + table + export (PDF/CSV).
- Financial reports cross-link from [17-billing](17-billing-payments.md).

## Acceptance criteria

- [ ] Reports can be filtered by the documented facets and exported to PDF and CSV/Excel.
- [ ] Conversion, revenue, consultation-trend, and case-performance reports render.
- [ ] Scheduled financial reports notify AR + management on generation.
- [ ] A user only sees report data permitted by their role.

## Out of scope (v1) / future

- Ad-hoc custom report builder (start with a defined catalog + filters).
- Cross-firm/benchmark analytics (multi-tenant aggregate).

## Decisions (v1)

- **Defined report catalog** (no custom builder in v1). Financial reports (revenue / overdue /
  monthly) run on a **schedule** (1st & 15th per the spec) plus on-demand; others are on-demand.
- Computed from **native data** with live queries in v1; materialized views/warehouse added if
  report volume requires it.
