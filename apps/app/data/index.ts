// Mock data for the Lawfficient staff platform scaffold.
// Deterministic (fixed dates/strings) so server and client renders match.
// Reference date for the dataset: 2026-06-04.

import type {
  Activity,
  CaseType,
  Client,
  Consultation,
  DocItem,
  Deadline,
  ImmigrationCase,
  Invoice,
  Kpi,
  Lead,
  SeriesPoint,
  StaffUser,
  CaseTask,
} from "./types"

export * from "./types"

// ---------------------------------------------------------------- Staff

export const STAFF: StaffUser[] = [
  { id: "u1", name: "Ayesha Rahman", email: "ayesha@chidolulaw.com", role: "attorney", initials: "AR", status: "active" },
  { id: "u2", name: "Marcus Bell", email: "marcus@chidolulaw.com", role: "attorney", initials: "MB", status: "active" },
  { id: "u3", name: "Nadia Okoro", email: "nadia@chidolulaw.com", role: "la_lead", initials: "NO", podId: "pod-a", status: "active" },
  { id: "u4", name: "Diego Santos", email: "diego@chidolulaw.com", role: "legal_assistant", initials: "DS", podId: "pod-a", status: "active" },
  { id: "u5", name: "Priya Nair", email: "priya@chidolulaw.com", role: "legal_assistant", initials: "PN", podId: "pod-a", status: "active" },
  { id: "u6", name: "Tomás Vega", email: "tomas@chidolulaw.com", role: "qa_lead", initials: "TV", status: "active" },
  { id: "u7", name: "Lena Hoffmann", email: "lena@chidolulaw.com", role: "creative_writer", initials: "LH", status: "active" },
  { id: "u8", name: "Carlos Mendez", email: "carlos@chidolulaw.com", role: "sales", initials: "CM", status: "active" },
  { id: "u9", name: "Grace Kim", email: "grace@chidolulaw.com", role: "sales", initials: "GK", status: "active" },
  { id: "u10", name: "Ruth Adeyemi", email: "ruth@chidolulaw.com", role: "accounts_receivable", initials: "RA", status: "active" },
  { id: "u11", name: "Owen Park", email: "owen@chidolulaw.com", role: "file_clerk", initials: "OP", status: "active" },
  { id: "u12", name: "Sofia Cruz", email: "sofia@chidolulaw.com", role: "admin", initials: "SC", status: "active" },
]

// Signed-in user for the scaffold (Sofia Cruz, admin). Resolved by id so the
// type is non-optional under noUncheckedIndexedAccess.
export const CURRENT_USER: StaffUser = STAFF.find((u) => u.id === "u12") ?? {
  id: "u12",
  name: "Sofia Cruz",
  email: "sofia@chidolulaw.com",
  role: "admin",
  initials: "SC",
  status: "active",
}

const byId = <T extends { id: string }>(rows: T[]) => {
  const map = new Map(rows.map((r) => [r.id, r]))
  return (id: string) => map.get(id)
}

export const staffById = byId(STAFF)
export const staffName = (id: string) => staffById(id)?.name ?? "Unassigned"

export const ROLE_LABELS: Record<StaffUser["role"], string> = {
  admin: "Admin",
  attorney: "Attorney",
  la_lead: "LA Team Lead",
  legal_assistant: "Legal Assistant",
  qa_lead: "QA Team Lead",
  creative_writer: "Creative Writer",
  sales: "Sales & Client Care",
  accounts_receivable: "Accounts Receivable",
  file_clerk: "File Clerk",
}

// ---------------------------------------------------------------- Leads

export const LEADS: Lead[] = [
  { id: "l1", firstName: "Maria", lastName: "Gonzalez", phone: "(305) 555-0142", email: "maria.g@email.com", source: "WhatsApp", status: "new", qualification: "pending", assignedToId: "u8", preferredLanguage: "Spanish", countryOfOrigin: "Mexico", city: "Miami", state: "FL", createdAt: "2026-06-04", lastActivity: "2026-06-04", caseType: "VAWA (AOS)" },
  { id: "l2", firstName: "Ahmed", lastName: "Hassan", phone: "(718) 555-0198", email: "a.hassan@email.com", source: "Facebook", status: "contacted", qualification: "pending", assignedToId: "u8", preferredLanguage: "Arabic", countryOfOrigin: "Egypt", city: "Brooklyn", state: "NY", createdAt: "2026-06-03", lastActivity: "2026-06-04", caseType: "Marriage-Based GC" },
  { id: "l3", firstName: "Liling", lastName: "Chen", phone: "(415) 555-0167", email: "liling.chen@email.com", source: "Referral", status: "consult_scheduled", qualification: "qualified", hierarchy: "HRC", caseType: "Marriage-Based GC", assignedToId: "u9", preferredLanguage: "Mandarin", countryOfOrigin: "China", city: "San Francisco", state: "CA", createdAt: "2026-06-01", lastActivity: "2026-06-03" },
  { id: "l4", firstName: "Sofia", lastName: "Rossi", phone: "(312) 555-0124", email: "sofia.rossi@email.com", source: "Website", status: "scheduled_paid", qualification: "qualified", hierarchy: "HRC", caseType: "VAWA (Abeyance)", assignedToId: "u9", preferredLanguage: "English", countryOfOrigin: "Italy", city: "Chicago", state: "IL", createdAt: "2026-05-30", lastActivity: "2026-06-02" },
  { id: "l5", firstName: "Daniel", lastName: "Okafor", phone: "(832) 555-0156", email: "d.okafor@email.com", source: "Instagram", status: "qualified_followup", qualification: "qualified", hierarchy: "NHRC", caseType: "N-400 Naturalization", assignedToId: "u8", preferredLanguage: "English", countryOfOrigin: "Nigeria", city: "Houston", state: "TX", createdAt: "2026-05-28", lastActivity: "2026-06-01" },
  { id: "l6", firstName: "Ana", lastName: "Beltran", phone: "(602) 555-0188", email: "ana.beltran@email.com", source: "Call Rails", status: "ea_sent", qualification: "qualified", hierarchy: "HRC", caseType: "VAWA (AOS)", assignedToId: "u9", preferredLanguage: "Spanish", countryOfOrigin: "Colombia", city: "Phoenix", state: "AZ", createdAt: "2026-05-25", lastActivity: "2026-06-03" },
  { id: "l7", firstName: "Viktor", lastName: "Petrov", phone: "(206) 555-0133", email: "v.petrov@email.com", source: "Website", status: "contacted", qualification: "pending", assignedToId: "u8", preferredLanguage: "Russian", countryOfOrigin: "Ukraine", city: "Seattle", state: "WA", createdAt: "2026-06-02", lastActivity: "2026-06-04", caseType: "Family-Based Petition" },
  { id: "l8", firstName: "Fatima", lastName: "Al-Sayed", phone: "(469) 555-0171", email: "fatima.s@email.com", source: "Referral", status: "not_qualified", qualification: "not_qualified", assignedToId: "u9", preferredLanguage: "Arabic", countryOfOrigin: "Syria", city: "Dallas", state: "TX", createdAt: "2026-05-29", lastActivity: "2026-05-31", notes: "Outside our practice area." },
  { id: "l9", firstName: "Jorge", lastName: "Ramirez", phone: "(323) 555-0119", email: "jorge.r@email.com", source: "WhatsApp", status: "new", qualification: "pending", assignedToId: "u8", preferredLanguage: "Spanish", countryOfOrigin: "Guatemala", city: "Los Angeles", state: "CA", createdAt: "2026-06-04", lastActivity: "2026-06-04", caseType: "VAWA (Abeyance)" },
  { id: "l10", firstName: "Mei", lastName: "Tanaka", phone: "(808) 555-0150", email: "mei.tanaka@email.com", source: "Facebook", status: "consult_scheduled", qualification: "pending", caseType: "Marriage-Based GC", assignedToId: "u9", preferredLanguage: "Japanese", countryOfOrigin: "Japan", city: "Honolulu", state: "HI", createdAt: "2026-06-01", lastActivity: "2026-06-03" },
  { id: "l11", firstName: "Samuel", lastName: "Mwangi", phone: "(404) 555-0177", email: "s.mwangi@email.com", source: "Instagram", status: "scheduled_paid", qualification: "qualified", hierarchy: "NHRC", caseType: "Removal of Conditions", assignedToId: "u8", preferredLanguage: "English", countryOfOrigin: "Kenya", city: "Atlanta", state: "GA", createdAt: "2026-05-27", lastActivity: "2026-06-02" },
  { id: "l12", firstName: "Elena", lastName: "Popescu", phone: "(702) 555-0144", email: "elena.p@email.com", source: "Website", status: "qualified_followup", qualification: "qualified", hierarchy: "HRC", caseType: "VAWA (AOS)", assignedToId: "u9", preferredLanguage: "Romanian", countryOfOrigin: "Romania", city: "Las Vegas", state: "NV", createdAt: "2026-05-26", lastActivity: "2026-06-01" },
  { id: "l13", firstName: "Carlos", lastName: "Herrera", phone: "(915) 555-0162", email: "c.herrera@email.com", source: "Call Rails", status: "lost", qualification: "pending", assignedToId: "u8", preferredLanguage: "Spanish", countryOfOrigin: "El Salvador", city: "El Paso", state: "TX", createdAt: "2026-05-20", lastActivity: "2026-05-24", notes: "Unresponsive after 4 attempts." },
  { id: "l14", firstName: "Priscilla", lastName: "Adeyemi", phone: "(773) 555-0185", email: "p.adeyemi@email.com", source: "Referral", status: "new", qualification: "pending", assignedToId: "u9", preferredLanguage: "English", countryOfOrigin: "Nigeria", city: "Chicago", state: "IL", createdAt: "2026-06-04", lastActivity: "2026-06-04", caseType: "N-400 Naturalization" },
]

export const leadById = byId(LEADS)
export const leadName = (l: Lead) => `${l.firstName} ${l.lastName}`

export const LEAD_STATUS_LABELS: Record<Lead["status"], string> = {
  new: "New",
  contacted: "Contacted",
  consult_scheduled: "Consult scheduled",
  scheduled_paid: "Scheduled & paid",
  qualified_followup: "Qualified follow-up",
  ea_sent: "EA sent",
  retained: "Retained",
  not_qualified: "Not qualified",
  lost: "Lost",
}

// Pipeline used for the funnel/board.
export const PIPELINE: { key: Lead["status"]; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "consult_scheduled", label: "Consult scheduled" },
  { key: "scheduled_paid", label: "Scheduled & paid" },
  { key: "qualified_followup", label: "Qualified follow-up" },
  { key: "ea_sent", label: "EA sent" },
  { key: "retained", label: "Retained" },
]

// ---------------------------------------------------------------- Consultations

export const CONSULTATIONS: Consultation[] = [
  { id: "c1", leadId: "l3", leadName: "Liling Chen", attorneyId: "u1", type: "Initial consultation", paid: true, amount: 150, status: "scheduled", startAt: "2026-06-05T15:00:00", durationMin: 45, timeZone: "PT", caseType: "Marriage-Based GC", bookedById: "u9" },
  { id: "c2", leadId: "l4", leadName: "Sofia Rossi", attorneyId: "u2", type: "Paid consultation", paid: true, amount: 200, status: "paid", startAt: "2026-06-05T18:30:00", durationMin: 60, timeZone: "CT", caseType: "VAWA (Abeyance)", bookedById: "u9" },
  { id: "c3", leadId: "l10", leadName: "Mei Tanaka", attorneyId: "u1", type: "Initial consultation", paid: false, status: "scheduled", startAt: "2026-06-06T17:00:00", durationMin: 30, timeZone: "HT", caseType: "Marriage-Based GC", bookedById: "u9" },
  { id: "c4", leadId: "l11", leadName: "Samuel Mwangi", attorneyId: "u2", type: "Paid consultation", paid: true, amount: 200, status: "paid", startAt: "2026-06-06T14:00:00", durationMin: 45, timeZone: "ET", caseType: "Removal of Conditions", bookedById: "u8" },
  { id: "c5", leadId: "l5", leadName: "Daniel Okafor", attorneyId: "u1", type: "Follow-up", paid: false, status: "completed", startAt: "2026-06-02T16:00:00", durationMin: 30, timeZone: "CT", caseType: "N-400 Naturalization", bookedById: "u8" },
  { id: "c6", leadId: "l6", leadName: "Ana Beltran", attorneyId: "u2", type: "Paid consultation", paid: true, amount: 150, status: "completed", startAt: "2026-06-01T19:00:00", durationMin: 60, timeZone: "MT", caseType: "VAWA (AOS)", bookedById: "u9" },
  { id: "c7", leadId: "l12", leadName: "Elena Popescu", attorneyId: "u1", type: "Initial consultation", paid: true, amount: 150, status: "rescheduled", startAt: "2026-06-08T15:30:00", durationMin: 45, timeZone: "PT", caseType: "VAWA (AOS)", bookedById: "u9" },
  { id: "c8", leadId: "l2", leadName: "Ahmed Hassan", attorneyId: "u2", type: "Initial consultation", paid: false, status: "scheduled", startAt: "2026-06-09T13:00:00", durationMin: 30, timeZone: "ET", caseType: "Marriage-Based GC", bookedById: "u8" },
]

export const consultationById = byId(CONSULTATIONS)

// ---------------------------------------------------------------- Clients (retained)

export const CLIENTS: Client[] = [
  { id: "cl1", name: "Rosa Delgado", caseType: "VAWA (AOS)", status: "active", laId: "u4", dateHired: "2026-04-12", totalFees: 7500, paid: 4500, balance: 3000, paymentStatus: "current" },
  { id: "cl2", name: "James Whitfield", caseType: "Marriage-Based GC", status: "monthly_plan", laId: "u5", dateHired: "2026-03-20", totalFees: 6000, paid: 2000, balance: 4000, paymentStatus: "current" },
  { id: "cl3", name: "Yuki Sato", caseType: "Removal of Conditions", status: "active", laId: "u4", dateHired: "2026-05-01", totalFees: 5500, paid: 5500, balance: 0, paymentStatus: "paid" },
  { id: "cl4", name: "Mohammed Farah", caseType: "VAWA (Abeyance)", status: "on_hold", laId: "u5", dateHired: "2026-02-15", totalFees: 7000, paid: 1500, balance: 5500, paymentStatus: "overdue" },
  { id: "cl5", name: "Isabella Romano", caseType: "N-400 Naturalization", status: "active", laId: "u4", dateHired: "2026-05-18", totalFees: 3500, paid: 1750, balance: 1750, paymentStatus: "current" },
  { id: "cl6", name: "Kwame Asante", caseType: "Family-Based Petition", status: "monthly_plan", laId: "u5", dateHired: "2026-01-30", totalFees: 8000, paid: 6000, balance: 2000, paymentStatus: "payment_arrangement" },
  { id: "cl7", name: "Lucia Fernandez", caseType: "VAWA (AOS)", status: "active", laId: "u4", dateHired: "2026-04-28", totalFees: 7500, paid: 3000, balance: 4500, paymentStatus: "current" },
  { id: "cl8", name: "Chen Wei", caseType: "Marriage-Based GC", status: "completed", laId: "u5", dateHired: "2025-11-10", totalFees: 6000, paid: 6000, balance: 0, paymentStatus: "paid" },
  { id: "cl9", name: "Amara Diallo", caseType: "VAWA (Abeyance)", status: "active", laId: "u4", dateHired: "2026-05-22", totalFees: 7000, paid: 2100, balance: 4900, paymentStatus: "current" },
  { id: "cl10", name: "Hassan Nazari", caseType: "NVC Case", status: "monthly_plan", laId: "u5", dateHired: "2026-03-05", totalFees: 9000, paid: 3600, balance: 5400, paymentStatus: "overdue" },
]

export const clientById = byId(CLIENTS)

// ---------------------------------------------------------------- Cases

export const CASES: ImmigrationCase[] = [
  { id: "case1", clientId: "cl1", clientName: "Rosa Delgado", caseType: "VAWA (AOS)", hierarchy: "HRC", difficulty: 2, status: "packet_prep", stage: 3, redFlag: "none", laId: "u4", attorneyId: "u1", dateHired: "2026-04-12", expectedMailing: "2026-06-07", checklistComplete: 78, openDeadlines: 0 },
  { id: "case2", clientId: "cl2", clientName: "James Whitfield", caseType: "Marriage-Based GC", hierarchy: "HRC", difficulty: 1, status: "in_review", stage: 6, redFlag: "none", laId: "u5", attorneyId: "u2", dateHired: "2026-03-20", expectedMailing: "2026-06-10", checklistComplete: 92, openDeadlines: 0 },
  { id: "case3", clientId: "cl3", clientName: "Yuki Sato", caseType: "Removal of Conditions", hierarchy: "NHRC", difficulty: 1, status: "filed", stage: 10, redFlag: "none", laId: "u4", attorneyId: "u2", dateHired: "2026-05-01", expectedMailing: "2026-05-29", checklistComplete: 100, openDeadlines: 0 },
  { id: "case4", clientId: "cl4", clientName: "Mohammed Farah", caseType: "VAWA (Abeyance)", hierarchy: "HRC", difficulty: 3, status: "rfe", stage: 4, redFlag: "red_flag_client", laId: "u5", attorneyId: "u1", dateHired: "2026-02-15", expectedMailing: "2026-05-20", checklistComplete: 64, openDeadlines: 1 },
  { id: "case5", clientId: "cl5", clientName: "Isabella Romano", caseType: "N-400 Naturalization", hierarchy: "NHRC", difficulty: 1, status: "onboarding", stage: 1, redFlag: "none", laId: "u4", attorneyId: "u2", dateHired: "2026-05-18", expectedMailing: "2026-06-20", checklistComplete: 35, openDeadlines: 0 },
  { id: "case6", clientId: "cl6", clientName: "Kwame Asante", caseType: "Family-Based Petition", hierarchy: "NHRC", difficulty: 2, status: "packet_prep", stage: 2, redFlag: "red_flag_packet", laId: "u5", attorneyId: "u1", dateHired: "2026-01-30", expectedMailing: "2026-06-02", checklistComplete: 71, openDeadlines: 1 },
  { id: "case7", clientId: "cl7", clientName: "Lucia Fernandez", caseType: "VAWA (AOS)", hierarchy: "HRC", difficulty: 2, status: "in_review", stage: 7, redFlag: "none", laId: "u4", attorneyId: "u1", dateHired: "2026-04-28", expectedMailing: "2026-06-12", checklistComplete: 88, openDeadlines: 0 },
  { id: "case8", clientId: "cl9", clientName: "Amara Diallo", caseType: "VAWA (Abeyance)", hierarchy: "HRC", difficulty: 2, status: "onboarding", stage: 1, redFlag: "none", laId: "u4", attorneyId: "u2", dateHired: "2026-05-22", expectedMailing: "2026-06-18", checklistComplete: 22, openDeadlines: 0 },
  { id: "case9", clientId: "cl10", clientName: "Hassan Nazari", caseType: "NVC Case", hierarchy: "HRC", difficulty: 3, status: "rfe", stage: 5, redFlag: "none", laId: "u5", attorneyId: "u2", dateHired: "2026-03-05", expectedMailing: "2026-06-15", checklistComplete: 80, openDeadlines: 1 },
  { id: "case10", clientId: "cl7", clientName: "Lucia Fernandez", caseType: "VAWA (AOS)", hierarchy: "HRC", difficulty: 2, status: "approved", stage: 10, redFlag: "none", laId: "u4", attorneyId: "u1", dateHired: "2026-04-28", expectedMailing: "2026-05-15", checklistComplete: 100, openDeadlines: 0 },
]

export const caseById = byId(CASES)

// ---------------------------------------------------------------- Deadlines

export const DEADLINES: Deadline[] = [
  { id: "d1", caseId: "case4", clientName: "Mohammed Farah", kind: "RFE", dueAt: "2026-06-09", dueInDays: 5, laId: "u5", attorneyId: "u1", status: "open" },
  { id: "d2", caseId: "case6", clientName: "Kwame Asante", kind: "NOID", dueAt: "2026-06-06", dueInDays: 2, laId: "u5", attorneyId: "u1", status: "open" },
  { id: "d3", caseId: "case9", clientName: "Hassan Nazari", kind: "RFE", dueAt: "2026-06-18", dueInDays: 14, laId: "u5", attorneyId: "u2", status: "open" },
  { id: "d4", caseId: "case8", clientName: "Amara Diallo", kind: "Abeyance Letter", dueAt: "2026-06-05", dueInDays: 1, laId: "u4", attorneyId: "u2", status: "open" },
  { id: "d5", caseId: "case4", clientName: "Mohammed Farah", kind: "RFE", dueAt: "2026-06-01", dueInDays: -3, laId: "u5", attorneyId: "u1", status: "overdue" },
]

// ---------------------------------------------------------------- Tasks

export const TASKS: CaseTask[] = [
  { id: "t1", caseId: "case4", title: "Draft RFE response — additional bona fides", assigneeId: "u5", dueLabel: "Due in 5 days", status: "in_progress", priority: "urgent" },
  { id: "t2", caseId: "case1", title: "Upload sign-off sheet (Stage 3 → 4)", assigneeId: "u4", dueLabel: "Due tomorrow", status: "not_started", priority: "high" },
  { id: "t3", caseId: "case6", title: "Respond to NOID — Kwame Asante", assigneeId: "u5", dueLabel: "Due in 2 days", status: "in_progress", priority: "urgent" },
  { id: "t4", caseId: "case5", title: "Send onboarding packet — Isabella Romano", assigneeId: "u4", dueLabel: "Due in 3 days", status: "not_started", priority: "normal" },
  { id: "t5", title: "Send quote letter — Elena Popescu", assigneeId: "u9", dueLabel: "Due today", status: "not_started", priority: "high" },
  { id: "t6", caseId: "case2", title: "Client review follow-up (3-pronged)", assigneeId: "u5", dueLabel: "Due in 4 days", status: "not_started", priority: "normal" },
]

// ---------------------------------------------------------------- Invoices

export const INVOICES: Invoice[] = [
  { id: "inv1", number: "INV-2041", clientId: "cl1", clientName: "Rosa Delgado", caseType: "VAWA (AOS)", total: 7500, paid: 4500, remaining: 3000, status: "partial", type: "monthly", dueAt: "2026-06-15", createdAt: "2026-04-12" },
  { id: "inv2", number: "INV-2042", clientId: "cl2", clientName: "James Whitfield", caseType: "Marriage-Based GC", total: 1000, paid: 1000, remaining: 0, status: "paid", type: "monthly", dueAt: "2026-06-01", createdAt: "2026-05-20" },
  { id: "inv3", number: "INV-2043", clientId: "cl4", clientName: "Mohammed Farah", caseType: "VAWA (Abeyance)", total: 7000, paid: 1500, remaining: 5500, status: "overdue", type: "monthly", dueAt: "2026-04-15", createdAt: "2026-02-15", monthsBehind: 2 },
  { id: "inv4", number: "INV-2044", clientId: "cl5", clientName: "Isabella Romano", caseType: "N-400 Naturalization", total: 3500, paid: 1750, remaining: 1750, status: "partial", type: "down_payment", dueAt: "2026-06-18", createdAt: "2026-05-18" },
  { id: "inv5", number: "INV-2045", clientId: "cl6", clientName: "Kwame Asante", caseType: "Family-Based Petition", total: 1000, paid: 1000, remaining: 0, status: "paid", type: "monthly", dueAt: "2026-06-01", createdAt: "2026-05-30" },
  { id: "inv6", number: "INV-2046", clientId: "cl10", clientName: "Hassan Nazari", caseType: "NVC Case", total: 9000, paid: 3600, remaining: 5400, status: "overdue", type: "monthly", dueAt: "2026-04-05", createdAt: "2026-03-05", monthsBehind: 2 },
  { id: "inv7", number: "INV-2047", clientId: "cl7", clientName: "Lucia Fernandez", caseType: "VAWA (AOS)", total: 7500, paid: 3000, remaining: 4500, status: "partial", type: "down_payment", dueAt: "2026-06-28", createdAt: "2026-04-28" },
  { id: "inv8", number: "INV-2048", clientId: "cl9", clientName: "Amara Diallo", caseType: "VAWA (Abeyance)", total: 7000, paid: 2100, remaining: 4900, status: "sent", type: "down_payment", dueAt: "2026-06-22", createdAt: "2026-05-22" },
  { id: "inv9", number: "INV-2049", clientId: "cl3", clientName: "Yuki Sato", caseType: "Removal of Conditions", total: 5500, paid: 5500, remaining: 0, status: "paid", type: "full_payment", dueAt: "2026-05-01", createdAt: "2026-05-01" },
  { id: "inv10", number: "INV-2050", clientId: "cl5", clientName: "Isabella Romano", caseType: "N-400 Naturalization", total: 710, paid: 0, remaining: 710, status: "sent", type: "filing_fee", dueAt: "2026-06-20", createdAt: "2026-06-03" },
  { id: "inv11", number: "INV-2051", clientId: "cl1", clientName: "Rosa Delgado", caseType: "VAWA (AOS)", total: 1500, paid: 0, remaining: 1500, status: "draft", type: "monthly", dueAt: "2026-07-01", createdAt: "2026-06-04" },
  { id: "inv12", number: "INV-2052", clientId: "cl2", clientName: "James Whitfield", caseType: "Marriage-Based GC", total: 200, paid: 200, remaining: 0, status: "paid", type: "consultation", dueAt: "2026-05-19", createdAt: "2026-05-19" },
]

// ---------------------------------------------------------------- Documents

export const DOCUMENTS: DocItem[] = [
  { id: "doc1", clientName: "Mohammed Farah", name: "RFE Notice (I-485)", category: "USCIS Mail", docType: "RFE", caseType: "VAWA (Abeyance)", uploadedById: "u11", uploadedAt: "2026-06-03", status: "verified" },
  { id: "doc2", clientName: "Rosa Delgado", name: "Affidavit of Support", category: "Client Upload", docType: "Evidence", caseType: "VAWA (AOS)", uploadedById: "u4", uploadedAt: "2026-06-02", status: "submitted" },
  { id: "doc3", clientName: "Yuki Sato", name: "I-797 Approval Notice", category: "USCIS Mail", docType: "Approval", caseType: "Removal of Conditions", uploadedById: "u11", uploadedAt: "2026-05-30", status: "verified" },
  { id: "doc4", clientName: "Isabella Romano", name: "Passport photos", category: "FBI Prints", docType: "Evidence", caseType: "N-400 Naturalization", uploadedById: "u11", uploadedAt: "2026-06-01", status: "pending" },
  { id: "doc5", clientName: "Kwame Asante", name: "NOID Notice", category: "USCIS Mail", docType: "NOID", caseType: "Family-Based Petition", uploadedById: "u11", uploadedAt: "2026-06-03", status: "verified" },
  { id: "doc6", clientName: "James Whitfield", name: "Marriage certificate", category: "Bona Fides", docType: "Evidence", caseType: "Marriage-Based GC", uploadedById: "u5", uploadedAt: "2026-05-28", status: "verified" },
  { id: "doc7", clientName: "Amara Diallo", name: "Police clearance", category: "Client Upload", docType: "Evidence", caseType: "VAWA (Abeyance)", uploadedById: "u4", uploadedAt: "2026-06-04", status: "pending" },
  { id: "doc8", clientName: "Hassan Nazari", name: "Interview notice", category: "USCIS Mail", docType: "Interview Notice", caseType: "NVC Case", uploadedById: "u11", uploadedAt: "2026-06-02", status: "submitted" },
  { id: "doc9", clientName: "Lucia Fernandez", name: "Medical exam (I-693)", category: "Medical", docType: "Evidence", caseType: "VAWA (AOS)", uploadedById: "u11", uploadedAt: "2026-05-31", status: "verified" },
  { id: "doc10", clientName: "Isabella Romano", name: "Receipt notice (I-797C)", category: "USCIS Mail", docType: "Receipt", caseType: "N-400 Naturalization", uploadedById: "u11", uploadedAt: "2026-06-04", status: "submitted" },
]

// ---------------------------------------------------------------- Activity

export const ACTIVITY: Activity[] = [
  { id: "a1", kind: "payment", text: "Kwame Asante paid monthly installment ($1,000)", byId: "u10", at: "10 min ago" },
  { id: "a2", kind: "lead", text: "New WhatsApp lead: Maria Gonzalez (VAWA AOS)", byId: "u8", at: "32 min ago" },
  { id: "a3", kind: "case", text: "Mohammed Farah flagged Red Flag Client — RFE due in 5 days", at: "1 hr ago" },
  { id: "a4", kind: "consultation", text: "Sofia Rossi consultation paid ($200)", byId: "u9", at: "2 hrs ago" },
  { id: "a5", kind: "document", text: "RFE Notice uploaded for Mohammed Farah", byId: "u11", at: "3 hrs ago" },
  { id: "a6", kind: "case", text: "Yuki Sato packet mailed to USCIS (tracking saved)", byId: "u4", at: "5 hrs ago" },
  { id: "a7", kind: "message", text: "Engagement agreement signed — Ana Beltran", at: "Yesterday" },
  { id: "a8", kind: "lead", text: "Liling Chen booked a consultation with Ayesha Rahman", byId: "u9", at: "Yesterday" },
]

// ---------------------------------------------------------------- Dashboard aggregates

export const KPIS: Kpi[] = [
  { label: "New leads (30d)", value: "48", delta: 12.5, hint: "vs. previous 30 days" },
  { label: "Upcoming consultations", value: "6", delta: 20, hint: "next 7 days" },
  { label: "Pending retainers (EA out)", value: "5", delta: -8.3, hint: "awaiting signature" },
  { label: "Revenue (June)", value: "$38,200", delta: 9.1, hint: "month to date" },
  { label: "Overdue balance", value: "$16,300", delta: 4.2, hint: "across 4 clients" },
  { label: "Red-flag cases", value: "2", delta: 0, hint: "need attention" },
]

export const REVENUE_BY_MONTH: SeriesPoint[] = [
  { month: "Jan", revenue: 41200 },
  { month: "Feb", revenue: 38600 },
  { month: "Mar", revenue: 47300 },
  { month: "Apr", revenue: 44900 },
  { month: "May", revenue: 52100 },
  { month: "Jun", revenue: 38200 },
]

export const CONSULTATIONS_BY_MONTH: SeriesPoint[] = [
  { month: "Jan", booked: 52, paid: 38, qualified: 24 },
  { month: "Feb", booked: 48, paid: 35, qualified: 21 },
  { month: "Mar", booked: 61, paid: 44, qualified: 29 },
  { month: "Apr", booked: 57, paid: 41, qualified: 27 },
  { month: "May", booked: 66, paid: 49, qualified: 33 },
  { month: "Jun", booked: 28, paid: 19, qualified: 12 },
]

export const CONVERSION_FUNNEL: { stage: string; value: number; fill: string }[] = [
  { stage: "Leads", value: 480, fill: "var(--chart-1)" },
  { stage: "Contacted", value: 372, fill: "var(--chart-2)" },
  { stage: "Consult booked", value: 246, fill: "var(--chart-3)" },
  { stage: "Qualified", value: 158, fill: "var(--chart-4)" },
  { stage: "Retained", value: 94, fill: "var(--chart-5)" },
]

export const CASE_TYPE_MIX: { name: string; value: number; fill: string }[] = [
  { name: "VAWA", value: 38, fill: "var(--chart-1)" },
  { name: "Marriage-Based", value: 24, fill: "var(--chart-2)" },
  { name: "N-400", value: 16, fill: "var(--chart-3)" },
  { name: "Family-Based", value: 14, fill: "var(--chart-4)" },
  { name: "Other", value: 8, fill: "var(--chart-5)" },
]

// ---------------------------------------------------------------- Case workspace

export const DECLARATION_STAGES = [
  "Drafting",
  "First QA review",
  "Supplemental intake",
  "Revision by creative writer",
  "Second QA review",
  "Upload for client review",
  "Final QA review",
  "Final approval & signature",
  "Completed & uploaded",
] as const

export const QA_CHECKLIST: { label: string; ref?: string }[] = [
  { label: "All USCIS forms are signed and dated" },
  { label: "Filing fees / fee waivers are correct", ref: "Fee schedule" },
  { label: "G-28 attached for the attorney of record" },
  { label: "Evidence is indexed and tabbed" },
  { label: "Addresses are consistent across all forms" },
  { label: "Cover letter and table of contents included" },
  { label: "Translations certified where required", ref: "8 CFR 103.2(b)(3)" },
]

const BASE_DOCS = [
  "Government-issued photo ID",
  "Passport bio page",
  "Birth certificate",
  "Proof of current address",
  "Two passport photos",
]

const DOCS_BY_TYPE: Partial<Record<CaseType, string[]>> = {
  "Marriage-Based GC": ["Marriage certificate", "Evidence of bona fide marriage", "Spouse's proof of status"],
  "VAWA (AOS)": ["Evidence of abuse", "Affidavit of good moral character", "Proof of shared residence"],
  "VAWA (Abeyance)": ["Evidence of abuse", "Affidavit of good moral character"],
  "N-400 Naturalization": ["Green card (front & back)", "Travel history (5 years)", "Tax transcripts"],
  "Removal of Conditions": ["Joint financial records", "Lease or mortgage", "Photos together over time"],
  "Family-Based Petition": ["Proof of qualifying relationship", "Petitioner's proof of status"],
  "NVC Case": ["Civil documents", "Affidavit of support (I-864)", "Police certificates"],
}

export function documentChecklistFor(caseType: CaseType): string[] {
  return [...BASE_DOCS, ...(DOCS_BY_TYPE[caseType] ?? [])]
}
