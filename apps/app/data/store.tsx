"use client"

import * as React from "react"

import { initialsOf } from "@/lib/format"
import {
  CASES,
  CLIENTS,
  CONSULTATIONS,
  CURRENT_USER,
  DEFAULT_PACKET_PIPELINE,
  DOCUMENTS,
  INVOICES,
  LEADS,
  STAFF,
} from "./index"
import type {
  AuditEntry,
  CaseType,
  Client,
  Consultation,
  DocItem,
  EntityKind,
  ImmigrationCase,
  Invoice,
  Lead,
  LeadSource,
  PacketStage,
  Role,
  StaffUser,
} from "./types"

const TODAY = "2026-06-04"

let counter = 9000
function nextId(prefix: string) {
  counter += 1
  return `${prefix}-${counter}`
}

// ---------------------------------------------------------------- Permissions
// Canonical matrix lives in @/lib/auth/permissions (shared by server + client).
// Re-exported here so existing imports from @/data/store keep working.

export { can, type Permission } from "@/lib/auth/permissions"

// ---------------------------------------------------------------- Inputs

export type NewLeadInput = {
  firstName: string
  lastName: string
  phone: string
  email: string
  source: LeadSource
  caseType?: CaseType
  preferredLanguage: string
  city: string
  state: string
  countryOfOrigin: string
  assignedToId: string
}

export type NewConsultationInput = {
  leadName: string
  attorneyId: string
  type: string
  paid: boolean
  amount?: number
  startAt: string
  timeZone: string
  caseType?: CaseType
}

export type NewDocumentInput = {
  clientName: string
  name: string
  category: DocItem["category"]
  docType: DocItem["docType"]
  caseType: CaseType
}

export type NewUserInput = { name: string; email: string; role: Role }

// ---------------------------------------------------------------- Store

type Store = {
  leads: Lead[]
  consultations: Consultation[]
  clients: Client[]
  cases: ImmigrationCase[]
  invoices: Invoice[]
  documents: DocItem[]
  staff: StaffUser[]
  auditLog: AuditEntry[]
  currentRole: Role
  setCurrentRole: (role: Role) => void
  addLead: (input: NewLeadInput) => Lead
  updateLead: (id: string, patch: Partial<Lead>, summary?: string) => void
  convertLead: (id: string) => void
  addConsultation: (input: NewConsultationInput) => Consultation
  updateConsultation: (id: string, patch: Partial<Consultation>, summary?: string) => void
  updateCase: (id: string, patch: Partial<ImmigrationCase>, summary?: string) => void
  updateClient: (id: string, patch: Partial<Client>, summary?: string) => void
  updateInvoice: (id: string, patch: Partial<Invoice>, summary?: string) => void
  addDocument: (input: NewDocumentInput) => DocItem
  updateDocument: (id: string, patch: Partial<DocItem>, summary?: string) => void
  addStaff: (input: NewUserInput) => StaffUser
  updateStaff: (id: string, patch: Partial<StaffUser>, summary?: string) => void
  setArchived: (entity: EntityKind, id: string, archived: boolean, label: string) => void
  addNote: (entity: EntityKind, id: string, label: string, text: string) => void
  packetPipeline: PacketStage[]
  pipelineFor: (caseType?: CaseType) => PacketStage[]
  addPacketStage: () => void
  updatePacketStage: (id: string, patch: Partial<PacketStage>) => void
  removePacketStage: (id: string) => void
  movePacketStage: (id: string, dir: -1 | 1) => void
  resetPacketPipeline: () => void
}

const SEED_AUDIT: AuditEntry[] = [
  { id: "audit-1", entity: "case", entityId: "case4", label: "Mohammed Farah", action: "Flagged as Red Flag Client", byUserId: "system", at: "1 hr ago" },
  { id: "audit-2", entity: "lead", entityId: "l3", label: "Liling Chen", action: "Booked a consultation", byUserId: "u9", at: "Yesterday" },
  { id: "audit-3", entity: "client", entityId: "cl1", label: "Rosa Delgado", action: "Retainer payment received", byUserId: "u10", at: "2 days ago" },
]

const StoreContext = React.createContext<Store | null>(null)

export function useStore() {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within MockStoreProvider")
  return ctx
}

export function MockStoreProvider({
  children,
  initialRole,
}: {
  children: React.ReactNode
  initialRole?: Role
}) {
  const [leads, setLeads] = React.useState<Lead[]>(LEADS)
  const [consultations, setConsultations] = React.useState<Consultation[]>(CONSULTATIONS)
  const [clients, setClients] = React.useState<Client[]>(CLIENTS)
  const [cases, setCases] = React.useState<ImmigrationCase[]>(CASES)
  const [invoices, setInvoices] = React.useState<Invoice[]>(INVOICES)
  const [documents, setDocuments] = React.useState<DocItem[]>(DOCUMENTS)
  const [staff, setStaff] = React.useState<StaffUser[]>(STAFF)
  const [auditLog, setAuditLog] = React.useState<AuditEntry[]>(SEED_AUDIT)
  const [currentRole, setCurrentRole] = React.useState<Role>(initialRole ?? CURRENT_USER.role)
  const [packetPipeline, setPacketPipeline] = React.useState<PacketStage[]>(DEFAULT_PACKET_PIPELINE)

  const logAudit = React.useCallback(
    (entity: EntityKind, entityId: string, label: string, action: string) => {
      setAuditLog((prev) => [
        { id: nextId("audit"), entity, entityId, label, action, byUserId: CURRENT_USER.id, at: "Just now" },
        ...prev,
      ])
    },
    [],
  )

  const value = React.useMemo<Store>(() => {
    const leadLabel = (id: string) => {
      const l = leads.find((x) => x.id === id)
      return l ? `${l.firstName} ${l.lastName}` : id
    }

    return {
      leads,
      consultations,
      clients,
      cases,
      invoices,
      documents,
      staff,
      auditLog,
      currentRole,
      setCurrentRole,

      addLead: (input) => {
        const lead: Lead = {
          id: nextId("lead"),
          status: "new",
          qualification: "pending",
          createdAt: TODAY,
          lastActivity: TODAY,
          ...input,
        }
        setLeads((prev) => [lead, ...prev])
        logAudit("lead", lead.id, `${lead.firstName} ${lead.lastName}`, "Created lead")
        return lead
      },
      updateLead: (id, patch, summary = "Updated lead details") => {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch, lastActivity: TODAY } : l)))
        logAudit("lead", id, leadLabel(id), summary)
      },
      convertLead: (id) => {
        const lead = leads.find((l) => l.id === id)
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, status: "retained", qualification: "qualified", lastActivity: TODAY } : l,
          ),
        )
        if (lead) {
          const la = STAFF.find((u) => u.role === "legal_assistant")
          const name = `${lead.firstName} ${lead.lastName}`
          const client: Client = {
            id: nextId("client"),
            name,
            caseType: lead.caseType ?? "Marriage-Based GC",
            status: "active",
            laId: la?.id ?? "u4",
            dateHired: TODAY,
            totalFees: 7500,
            paid: 0,
            balance: 7500,
            paymentStatus: "current",
          }
          setClients((cs) => [client, ...cs])
          logAudit("lead", id, name, "Converted to retained client")
          logAudit("client", client.id, name, "Client created from lead")
        }
      },

      addConsultation: (input) => {
        const consultation: Consultation = {
          id: nextId("consult"),
          leadId: "new",
          durationMin: 30,
          status: input.paid ? "paid" : "scheduled",
          bookedById: CURRENT_USER.id,
          ...input,
        }
        setConsultations((prev) => [consultation, ...prev])
        logAudit("consultation", consultation.id, consultation.leadName, "Booked consultation")
        return consultation
      },
      updateConsultation: (id, patch, summary = "Updated consultation") => {
        setConsultations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
        const c = consultations.find((x) => x.id === id)
        logAudit("consultation", id, c?.leadName ?? id, summary)
      },

      updateCase: (id, patch, summary = "Updated case") => {
        setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
        const c = cases.find((x) => x.id === id)
        logAudit("case", id, c?.clientName ?? id, summary)
      },

      updateClient: (id, patch, summary = "Updated client") => {
        setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
        const c = clients.find((x) => x.id === id)
        logAudit("client", id, c?.name ?? id, summary)
      },

      updateInvoice: (id, patch, summary = "Updated invoice") => {
        setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
        const i = invoices.find((x) => x.id === id)
        logAudit("invoice", id, i ? `${i.number} · ${i.clientName}` : id, summary)
      },

      addDocument: (input) => {
        const doc: DocItem = {
          id: nextId("doc"),
          uploadedById: CURRENT_USER.id,
          uploadedAt: TODAY,
          status: "submitted",
          ...input,
        }
        setDocuments((prev) => [doc, ...prev])
        logAudit("document", doc.id, doc.name, `Uploaded document for ${doc.clientName}`)
        return doc
      },
      updateDocument: (id, patch, summary = "Updated document") => {
        setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
        const d = documents.find((x) => x.id === id)
        logAudit("document", id, d?.name ?? id, summary)
      },

      addStaff: (input) => {
        const user: StaffUser = {
          id: nextId("user"),
          initials: initialsOf(input.name),
          status: "invited",
          ...input,
        }
        setStaff((prev) => [...prev, user])
        logAudit("user", user.id, user.name, "Invited user")
        return user
      },
      updateStaff: (id, patch, summary = "Updated user") => {
        setStaff((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
        const u = staff.find((x) => x.id === id)
        logAudit("user", id, u?.name ?? id, summary)
      },

      setArchived: (entity, id, archived, label) => {
        const flip = <T extends { id: string; archived?: boolean }>(rows: T[]) =>
          rows.map((x) => (x.id === id ? { ...x, archived } : x))
        if (entity === "lead") setLeads((p) => flip(p))
        else if (entity === "consultation") setConsultations((p) => flip(p))
        else if (entity === "client") setClients((p) => flip(p))
        else if (entity === "case") setCases((p) => flip(p))
        else if (entity === "invoice") setInvoices((p) => flip(p))
        else if (entity === "document") setDocuments((p) => flip(p))
        logAudit(entity, id, label, archived ? "Archived" : "Restored")
      },

      addNote: (entity, id, label, text) => {
        logAudit(entity, id, label, `Note: ${text}`)
      },

      packetPipeline,
      // Firm-wide pipeline for now; per-case-type overrides will branch here later.
      pipelineFor: () => packetPipeline,
      addPacketStage: () =>
        setPacketPipeline((prev) => [...prev, { id: nextId("ps"), name: "New stage", slaDays: 1 }]),
      updatePacketStage: (id, patch) =>
        setPacketPipeline((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
      removePacketStage: (id) => setPacketPipeline((prev) => prev.filter((s) => s.id !== id)),
      movePacketStage: (id, dir) =>
        setPacketPipeline((prev) => {
          const i = prev.findIndex((s) => s.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= prev.length) return prev
          const next = prev.slice()
          const a = next[i]!
          next[i] = next[j]!
          next[j] = a
          return next
        }),
      resetPacketPipeline: () => setPacketPipeline(DEFAULT_PACKET_PIPELINE),
    }
  }, [leads, consultations, clients, cases, invoices, documents, staff, auditLog, currentRole, packetPipeline, logAudit])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
