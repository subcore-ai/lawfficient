# 11 · Dashboard

> **Module:** `dashboard` · **Status:** Draft · **Source:** Feature §2.2.2 · **Roles:** All (role-scoped)

## Purpose

The landing screen after login: an at-a-glance summary of the metrics, work, and alerts most
relevant to the signed-in user's role, with quick access to recent activity and notifications.

## Roles & permissions

All roles see a dashboard; **content is scoped to the role**. A Sales/CC rep sees leads and
consultations; an LA Lead sees pod packet health and red flags; AR sees revenue and overdue;
Management sees firm-wide rollups.

## Functional requirements

- **FR-dashboard-1** — Summary of key metrics: number of leads, upcoming consultations,
  pending retainers, revenue.
- **FR-dashboard-2** — **User-customizable widgets** (add/remove/reorder).
- **FR-dashboard-3** — Quick access to recent activity and notifications.
- **FR-dashboard-4** — Visual analytics: charts for lead conversion, revenue, consultation
  trends.
- **FR-dashboard-5** — Role-scoped content and metrics (see roles above).
- **FR-dashboard-6** — Surfacing of urgent items: upcoming consultations, payment due dates,
  case updates, missing documents, **red-flag cases**, RFE/NOID deadlines (source §2.2.8 alerts).
- **FR-dashboard-7** — Each widget links to its module's full view.

## Data model

Reads from other modules; no owned entities. A **DashboardLayout** per user persists widget
selection/order (`userId`, `widgets[]`).

- **Widget** — `key`, `title`, `size`, `position`, `roleVisibility[]`.

## Screens

- `/` — dashboard grid:
  - **KPI cards:** New leads (period), Upcoming consultations, Pending retainers/EAs out,
    Revenue (period), Overdue balance, Red-flag cases.
  - **Charts:** Lead conversion funnel/rate, Revenue trend, Consultation trends (booked vs
    paid vs qualified).
  - **Lists:** Upcoming consultations, Recent activity, Red-flag / overdue-deadline cases,
    Tasks assigned to me.

## Acceptance criteria

- [ ] Dashboard renders role-appropriate KPIs and links to each module.
- [ ] Charts display conversion, revenue, and consultation-trend data.
- [ ] Red-flag cases and imminent RFE/NOID deadlines are surfaced prominently.
- [ ] A user can add/remove/reorder widgets and the layout persists.

## Out of scope (v1) / future

- Cross-firm benchmarking (multi-tenant aggregate analytics).
- Fully free-form custom widget builder (start with a fixed widget catalog).

## Decisions (v1)

- **Fixed widget catalog per role** in v1 (drag-to-customize is a later enhancement).
- **Global time-range control** (Today / 7d / 30d / custom), applied across the dashboard.
