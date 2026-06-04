# 14 · Retention & Engagement

> **Module:** `retention` · **Status:** Draft · **Use cases:** UC14, UC15, UC23, UC24, "Convert Lead"
> **Primary roles:** Legal Assistant(s), Attorney, Accounts Receivable

## Purpose

Convert qualified consultations into retained clients: send quote letters, generate and send
templated engagement agreements (EAs) with e-signature, manage the templates behind both, and
hand a signed-and-paid client to onboarding/case management.

## Roles & permissions

| Role | Capability |
|------|-----------|
| Attorney | Assign quote-letter task; select retainer type; sign EAs. |
| Legal Assistant / Lead | Send quote letters; prepare & send EAs; update case description. |
| AR | Convert lead → retained client; invoice; provision portal access. |
| Admin | Manage quote-letter & EA templates (UC23, UC24). |

## Use cases

- **UC14 — Sending Quote Letters.** Attorney assigns an urgent task to a responsible party
  (LA); system emails + in-app notifies them; LA opens consultation notes, identifies case
  type, composes the email (From = attorney, CC, recipients), attaches the correct documents
  (quote letter, process timeline), auto-filled name/body by case type, sends.
- **UC15 — Sending an Engagement Agreement.** From consultation notes, verify qualification →
  select retainer type (e.g. "VAWA with AOS") → update case description → Send Document →
  pick template (e.g. one-signer) → choose signer (attorney) + deadline → edit payment plan
  (total, retainer, monthly) → ensure USCIS filing fees included if on a payment plan →
  Save → Send to attorney + client for signing.
- **UC23 — Managing Quote Letter Attachments.** Admin uploads/removes/updates PDF quote-letter
  templates in a central store; changes are immediately available; delete has a recovery option.
- **UC24 — Managing Engagement Agreement Templates.** Admin edits EA templates with three
  sections — (1) First Page & Intro (static), (2) Scope of Services (**conditional by case
  type**), (3) Final Terms & Conditions (static); configure conditional logic for §2.
- **Convert Lead → Retained Client (AR).** Precondition: lead "Qualified to Hire Us" + quote
  letter sent. AR generates an invoice; if payment plan, confirm installments/due dates;
  client pays initial deposit or full; card may be stored for recurring; on payment, status →
  **Retained Client**. Failure to pay initial deposit keeps the lead "Qualified".

## Functional requirements

- **FR-retention-1** — Generate & send templated **quote letters / battery charts** to
  qualified leads, with correct attachments selected by case type.
- **FR-retention-2** — Task assignment for quote-letter / code-letter follow-up, with email +
  in-app notification to the assignee.
- **FR-retention-3** — Generate **engagement agreements** from templates, choosing one- or
  two-signer variants and the signing attorney + deadline.
- **FR-retention-4** — **E-signature** support for agreements (attorney + client).
- **FR-retention-5** — EA payment-plan editor: total amount, retainer, monthly installments,
  inclusion of USCIS filing fees when on a plan.
- **FR-retention-6** — Conditional EA content: Scope-of-Services section varies by case type;
  intro & terms are static; block send if case type unselected.
- **FR-retention-7** — Convert a qualified lead to a **retained client** on signed EA + paid
  initial deposit/full payment; provision client-portal access; update pipeline status.
- **FR-retention-8** — Quote-letter & EA **template management** for Admin (upload/edit/
  remove, with delete recovery).
- **FR-retention-9** — Track agreement state: drafted → sent → signed (by whom) → countersigned.

## Data model

- **QuoteLetter** — `id`, `leadId`, `caseType`, `templateId`, `attachments[]`, `sentByUserId`,
  `sentAt`, `recipients[]`.
- **EngagementAgreement** — `id`, `leadId`/`clientId`, `templateId`, `variant`
  (`one_signer|two_signer`), `caseType`, `scopeOfServices`, `signerAttorneyUserId`,
  `deadline?`, `paymentPlan`, `status` (`draft|sent|partially_signed|signed`), `signatures[]`.
- **PaymentPlan** — `total`, `retainer`, `monthlyAmount`, `installments[]`, `includesUscisFees`.
- **Template** — `id`, `kind` (`quote_letter|engagement_agreement`), `name`, `sections`/`file`,
  `conditionalRules?`, `isActive`, `archivedAt?`.

## Screens

- `/leads/[id]` → "Send quote letter" and "Send engagement agreement" actions.
- `/clients` — retained clients (post-conversion) — see [15](15-case-management.md)/clients.
- `/settings/templates` — quote-letter & EA template management (Admin) — see [22](22-admin-settings.md).

## Acceptance criteria

- [ ] A quote letter is sent to a qualified lead with case-type-correct attachments.
- [ ] An EA is generated from a template, sent for e-signature, and tracked through signing.
- [ ] EA Scope-of-Services changes with case type; sending is blocked without a case type.
- [ ] Paying the initial deposit on a signed EA converts the lead to a retained client and
      provisions portal access.
- [ ] Admin can upload/replace/remove templates; a deleted template can be recovered.

## Out of scope (v1) / future

- In-house e-signature engine (may integrate a provider first).
- Automated quote pricing from a rate card.

## Open questions

- E-signature provider (build vs. integrate)?
- Are quote-letter templates pure PDFs (UC23) while EA templates are structured/sectioned
  (UC24)? Confirm both editing models.
