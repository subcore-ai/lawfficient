// Domain types for the Lawfficient staff platform.
// Mirrors /specs entities; see specs/01-glossary-and-domain.md.
// Dates are ISO strings so server/client render deterministically (no hydration drift).

export type Role =
  | "admin"
  | "attorney"
  | "la_lead"
  | "legal_assistant"
  | "qa_lead"
  | "creative_writer"
  | "sales"
  | "accounts_receivable"
  | "file_clerk"

export type StaffUser = {
  id: string
  name: string
  email: string
  role: Role
  initials: string
  podId?: string
  status: "active" | "invited" | "disabled"
}

// ---- Immigration domain ----

export type CaseType =
  | "VAWA (Abeyance)"
  | "VAWA (AOS)"
  | "Marriage-Based GC"
  | "N-400 Naturalization"
  | "Family-Based Petition"
  | "NVC Case"
  | "Removal of Conditions"

export type CaseHierarchy = "HRC" | "NHRC"

export const CASE_TYPES: CaseType[] = [
  "VAWA (Abeyance)",
  "VAWA (AOS)",
  "Marriage-Based GC",
  "N-400 Naturalization",
  "Family-Based Petition",
  "NVC Case",
  "Removal of Conditions",
]

// ---- Leads & CRM ----

export type LeadSource =
  | "WhatsApp"
  | "Facebook"
  | "Call Rails"
  | "Website"
  | "Referral"
  | "Instagram"

export type LeadStatus =
  | "new"
  | "contacted"
  | "consult_scheduled"
  | "scheduled_paid"
  | "qualified_followup"
  | "ea_sent"
  | "retained"
  | "not_qualified"
  | "lost"

export type Qualification = "qualified" | "not_qualified" | "pending"

export type Lead = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  source: LeadSource
  status: LeadStatus
  qualification: Qualification
  caseType?: CaseType
  hierarchy?: CaseHierarchy
  assignedToId: string
  preferredLanguage: string
  countryOfOrigin: string
  city: string
  state: string
  createdAt: string
  lastActivity: string
  notes?: string
  archived?: boolean
}

export type Interaction = {
  id: string
  leadId: string
  type: "call" | "sms" | "email" | "note" | "disposition"
  summary: string
  byId: string
  at: string
}

// ---- Consultations ----

export type ConsultationStatus =
  | "scheduled"
  | "paid"
  | "completed"
  | "rescheduled"
  | "canceled"
  | "no_show"

export type Consultation = {
  id: string
  leadId: string
  leadName: string
  attorneyId: string
  type: string
  paid: boolean
  amount?: number
  status: ConsultationStatus
  startAt: string
  durationMin: number
  timeZone: string
  caseType?: CaseType
  bookedById: string
  archived?: boolean
}

// ---- Case management ----

export const PACKET_STAGES = [
  "Document gathering & prep",
  "First QA review",
  "Corrections by LA",
  "Document-review attorney",
  "Corrections by LA",
  "Office attorney review",
  "Client review",
  "Correction by LA",
  "Final attorney review",
  "Packet mailed",
] as const

export type PacketStage = { id: string; name: string; slaDays: number }

export type RedFlag = "none" | "red_flag_client" | "red_flag_packet"

export type CaseStatus = "onboarding" | "packet_prep" | "in_review" | "filed" | "rfe" | "approved"

export type ImmigrationCase = {
  id: string
  clientId: string
  clientName: string
  caseType: CaseType
  hierarchy: CaseHierarchy
  difficulty: 1 | 2 | 3
  status: CaseStatus
  stage: number // 1-10 index into PACKET_STAGES
  redFlag: RedFlag
  laId: string
  attorneyId: string
  dateHired: string
  expectedMailing: string
  checklistComplete: number // 0-100
  openDeadlines: number
  archived?: boolean
}

export type Deadline = {
  id: string
  caseId: string
  clientName: string
  kind: "RFE" | "NOID" | "Denial" | "Abeyance Letter"
  dueAt: string
  dueInDays: number
  laId: string
  attorneyId: string
  status: "open" | "responded" | "overdue"
}

export type CaseTask = {
  id: string
  caseId?: string
  title: string
  assigneeId: string
  dueLabel: string
  status: "not_started" | "in_progress" | "completed"
  priority: "low" | "normal" | "high" | "urgent"
}

// ---- Clients (retained) ----

export type ClientStatus = "active" | "monthly_plan" | "on_hold" | "completed" | "terminated"

export type Client = {
  id: string
  name: string
  caseType: CaseType
  status: ClientStatus
  laId: string
  dateHired: string
  totalFees: number
  paid: number
  balance: number
  paymentStatus: "current" | "overdue" | "paid" | "payment_arrangement"
  archived?: boolean
}

// ---- Billing ----

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "void"

export type PaymentType =
  | "down_payment"
  | "monthly"
  | "full_payment"
  | "partial_down"
  | "consultation"
  | "filing_fee"

export type Invoice = {
  id: string
  number: string
  clientId: string
  clientName: string
  caseType: CaseType
  total: number
  paid: number
  remaining: number
  status: InvoiceStatus
  type: PaymentType
  dueAt: string
  createdAt: string
  monthsBehind?: number
  archived?: boolean
}

// ---- Documents ----

export type DocItem = {
  id: string
  clientName: string
  name: string
  category: "USCIS Mail" | "Client Upload" | "FBI Prints" | "Bona Fides" | "Form" | "Medical"
  docType: "Approval" | "RFE" | "NOID" | "Interview Notice" | "Receipt" | "Evidence"
  caseType: CaseType
  uploadedById: string
  uploadedAt: string
  status: "pending" | "submitted" | "verified"
  archived?: boolean
}

// ---- Activity & notifications ----

export type Activity = {
  id: string
  kind: "lead" | "consultation" | "payment" | "case" | "document" | "message"
  text: string
  byId?: string
  at: string
}

// ---- Audit / change log ----

export type EntityKind =
  | "lead"
  | "consultation"
  | "client"
  | "case"
  | "invoice"
  | "document"
  | "user"

export type AuditEntry = {
  id: string
  entity: EntityKind
  entityId: string
  label: string
  action: string
  byUserId: string
  at: string
}

// ---- Dashboard aggregates ----

export type Kpi = {
  label: string
  value: string
  delta: number // percent, +/-
  hint: string
}

export type SeriesPoint = { month: string; [key: string]: string | number }
