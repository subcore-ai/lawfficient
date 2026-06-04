# 01 · Glossary & Domain Model

> **Status:** Draft · **Source:** Product Spec v1.0 (2025-02-03), §5 + domain throughout

Shared vocabulary for the immigration-law domain and the Lawfficient system. Module specs
reference these terms rather than re-defining them.

## Client lifecycle pipeline

The lead/client funnel (source UC16 "Tracking Lead Flow", UC43):

```
New Lead → Consult Scheduled → Scheduled & Paid Consultation
        → (Rescheduling) → Qualified Consults for Follow-Up
        → EA Sent → Hired / Retained Client → (Case Management) → Drop-off / Completed
```

- **Lead** — a potential client captured from a source (WhatsApp, Facebook/social, Call Rails,
  website ads, referrals). Has status `New`, responsive/unresponsive, qualified/not-qualified/
  pending-decision.
- **Qualified lead** — attorney determined the firm can take the case (now / future-hire).
- **Retained client** — signed the engagement agreement and paid initial deposit/full payment.
- **Drop-off** — a monthly-payment client who left: fully paid, withdrawn, or terminated.

## Case types (immigration)

- **VAWA** (Violence Against Women Act self-petition) — variants: **VAWA with abeyance**,
  **VAWA with AOS / Adjustment of Status**. VAWA cases have **no USCIS filing fees**.
- **Marriage-Based Green Card** (e.g. AOS).
- **N-400** — Naturalization.
- **Family-Based Petition**.
- **NVC case** (National Visa Center).
- **Joint Removal of Conditions**.
- **Case hierarchy / revenue tier:** **HRC** (High Revenue Case) vs **NHRC** (Non-High
  Revenue Case).
- **Case difficulty level:** 1, 2, or 3.

## USCIS forms & documents

- **Forms:** I-130 (petition for relative), I-485 (adjustment of status), I-360 (VAWA
  self-petition), G-28 (notice of attorney representation), I-693 (sealed medical exam),
  I-94 (arrival/departure record).
- **RFE** — Request for Evidence (has a due date).
- **NOID** — Notice of Intent to Deny (has a due date).
- **Denial** — case denial notice (has a response deadline).
- **Receipt notice** — USCIS receipt with a **receipt number** (used for status lookup).
- **Approval** — USCIS approval notice.
- **Battery chart** — quote/eligibility chart delivered to qualified leads.
- **Quote letter / code letter** — fee quote sent to a qualified lead before retention.
- **Engagement Agreement (EA)** — retainer contract; e-signed; templated (one-signer /
  two-signer) with conditional Scope-of-Services by case type.
- **Affidavit of Support**, **Evidence Checklist**, **Welcome Letter** — onboarding documents.

## Packet preparation stages (UC19, UC32)

A case "packet" moves through staged review with per-stage turnaround SLAs; exceeding a stage
SLA flags the case as a **Red Flag Client / Red Flag Packet** and notifies team leads + management.

| Stage | Description | Default SLA |
|-------|-------------|-------------|
| 1 | Document gathering & packet prep | 20 days |
| 2 | First review by QA | 5 days |
| 3 | Corrections by LA | 3 days |
| 4 | Review by document-review attorney | 7 days |
| 5 | Corrections by LA | 2 days |
| 6 | Review by office attorney & corrections by LA | 14 days |
| 7 | Client review | 2 days |
| 8 | Another correction by LA | 1 day |
| 9 | Checklist & final review by attorney | 1 day |
| 10 | Packet mailed out | 1 day |

> Printing/mailing has an extended FileClerk variant (UC32) with stages through **Stage 12
> (Mailed to USCIS)**, capturing printed → in-queue → reviewed → corrections → client approval
> → final checklist → mailed (date + tracking number saved).

## Declaration lifecycle (UC20)

For cases requiring a declaration (drafted by Creative Writers):

| Stage | Description | SLA |
|-------|-------------|-----|
| 1 | Drafting | 1 day |
| 2 | First QA review | 2 days |
| 3 | Supplemental intake (if needed) | 2 days |
| 4 | Revision by creative writer | 1 day |
| 5 | Second QA review | 3 days |
| 6 | Upload for client review by LA | 3 days |
| 7 | Final QA review | 1 day |
| 8 | Final approval & client signature by LA | 2 days |
| 9 | Declaration completed & uploaded | — |

## Sign-off & endorsement

- **Task endorsement** — handoff of a case/task between roles (LA ↔ QA ↔ attorney ↔ creative
  writer), each generating notifications and tasks.
- **Sign-off sheet** — a signed/dated artifact a LA must download, complete, and re-upload
  before a packet may progress past certain stages (e.g. before Stage 4 and after Stage 4).
  The system blocks progression if a required sign-off sheet is missing.

## Payments

- **Payment types:** down payment, partial down payment, monthly, full payment, partial full
  payment, booked-consultation fee, shipping/processing fee.
- **Split payment** — a single charge spread across multiple cards.
- **Payment plan** — installments with due dates; may include USCIS filing fees.
- **Overdue classifications:** normal collections, termination, packet-not-yet-sent, case-on-
  hold. Client buckets: 1 month behind; 2+ months behind <$1,000 balance; 2+ months behind
  >$1,000 balance.
- **Payment statuses:** Paid, Not Paid, Has Payment Arrangement, Has Leniency from Management,
  For Termination, Not Qualified for Termination, Case on Hold.

## External systems

- **RingCentral** — telephony (inbound call ID, disposition, notes).
- **MyCase** — legacy case-management system being migrated _from_ (UC33).
- **Docketwise** — USCIS form preparation; auto-fills forms from intake (UC37, UC39, UC41).
- **Jotforms** — client intake questionnaires feeding Docketwise.
- **Dropbox** — document storage; per-client folders linked into the platform.
- **USCIS** — case status lookup via receipt number.

## System glossary

- **Actor** — a role that interacts with the system.
- **Dashboard** — visual representation of key performance indicators.
- **Pod** — a team grouping (e.g. a Legal Assistant Team Lead monitors the LAs in their pod).
- **Disposition** — the outcome classification a staff member records after a call.
