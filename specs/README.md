# Lawfficient — Product Specifications

Spec-driven development for **Lawfficient**, an AI-assisted, all-in-one practice-management
platform for immigration law firms. These documents decompose the source product spec
(_Product Spec & End-to-End Workflow_, v1.0, 2025-02-03) into engineering-ready, per-module
specifications.

## How these specs are organized

- **Cross-cutting** (`00`–`03`) — context every module depends on: product overview,
  domain glossary, the role/permission model, and the architecture & v1-scope decisions.
- **Modules** (`10`–`22`) — one spec per functional area of the product. Each maps to a set
  of use cases (UC#) from the source spec and describes purpose, roles, requirements, data
  model, screens, and acceptance criteria.

Each module spec follows the same template (see [`_template.md`](_template.md)).

## Index

| #  | Spec | Covers (source use cases) |
|----|------|---------------------------|
| 00 | [Product Overview](00-product-overview.md) | §1 Overview, §4 Non-functional |
| 01 | [Glossary & Domain](01-glossary-and-domain.md) | §5 Appendix + immigration domain |
| 02 | [Roles & Permissions](02-roles-and-permissions.md) | §2.1 Roles, UC1, UC25 |
| 03 | [Architecture & v1 Scope](03-architecture-and-scope.md) | Cross-cutting decisions, stack, scope |
| 10 | [Authentication & Access](10-authentication.md) | UC1 |
| 11 | [Dashboard](11-dashboard.md) | Feature §2.2.2 |
| 12 | [Leads & CRM](12-leads-crm.md) | UC2–7, UC16, UC43 |
| 13 | [Consultations & Scheduling](13-consultations-scheduling.md) | UC4, UC8–13 |
| 14 | [Retention & Engagement](14-retention-engagement.md) | UC14, UC15, UC23, UC24, "Convert Lead" |
| 15 | [Case Management](15-case-management.md) | UC17–22, UC28–33 |
| 16 | [Documents](16-documents.md) | UC18, UC31, UC33 (medical), UC37, UC39, UC41 |
| 17 | [Billing & Payments](17-billing-payments.md) | UC8, UC9, UC34, UC35, UC36 |
| 18 | [Client Portal](18-client-portal.md) | UC27, UC38, UC42 |
| 19 | [Communications & Notifications](19-communications-notifications.md) | UC26, UC42, UC44 |
| 20 | [Reporting & Analytics](20-reporting-analytics.md) | Feature §2.2.7 |
| 21 | [Integrations](21-integrations.md) | UC2, UC33 (migration), UC37, UC39 |
| 22 | [Admin & Settings](22-admin-settings.md) | UC23, UC24, UC25 |

## Conventions

- **Status** of each spec: `Draft` until reviewed by product + engineering.
- **Requirements** are written as `FR-<module>-<n>` so they can be referenced from tickets,
  tests, and PRs.
- **Screens** sections name the routes the app renders, so specs trace to UI in `apps/app`.
- The **first surface** being built is the **internal staff platform**. The client-facing
  portal (`18`) is specified but built in a later pass.

## Source

The authoritative source is the product spec PDF authored by Chinedu Chidolue and Raisen
Esperanza. Cross-cutting gaps were resolved in the **2026-06-04 review** and recorded in
[03-architecture-and-scope](03-architecture-and-scope.md); each module's **Decisions (v1)**
section reflects those calls. Anything still genuinely undecided stays under **Open questions**.
