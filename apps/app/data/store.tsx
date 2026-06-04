"use client"

import * as React from "react"

import { initialsOf } from "@/lib/format"
import {
  CASES,
  CLIENTS,
  CONSULTATIONS,
  CURRENT_USER,
  DOCUMENTS,
  INVOICES,
  LEADS,
  STAFF,
} from "./index"
import type {
  CaseType,
  Client,
  Consultation,
  DocItem,
  ImmigrationCase,
  Invoice,
  Lead,
  LeadSource,
  Role,
  StaffUser,
} from "./types"

const TODAY = "2026-06-04"

let counter = 9000
function nextId(prefix: string) {
  counter += 1
  return `${prefix}-${counter}`
}

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

type Store = {
  leads: Lead[]
  consultations: Consultation[]
  clients: Client[]
  cases: ImmigrationCase[]
  invoices: Invoice[]
  documents: DocItem[]
  staff: StaffUser[]
  addLead: (input: NewLeadInput) => Lead
  updateLead: (id: string, patch: Partial<Lead>) => void
  convertLead: (id: string) => void
  addConsultation: (input: NewConsultationInput) => Consultation
  updateConsultation: (id: string, patch: Partial<Consultation>) => void
  updateCase: (id: string, patch: Partial<ImmigrationCase>) => void
  addDocument: (input: NewDocumentInput) => DocItem
  addStaff: (input: NewUserInput) => StaffUser
  updateStaff: (id: string, patch: Partial<StaffUser>) => void
}

const StoreContext = React.createContext<Store | null>(null)

export function useStore() {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within MockStoreProvider")
  return ctx
}

export function MockStoreProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = React.useState<Lead[]>(LEADS)
  const [consultations, setConsultations] = React.useState<Consultation[]>(CONSULTATIONS)
  const [clients, setClients] = React.useState<Client[]>(CLIENTS)
  const [cases, setCases] = React.useState<ImmigrationCase[]>(CASES)
  const [invoices] = React.useState<Invoice[]>(INVOICES)
  const [documents, setDocuments] = React.useState<DocItem[]>(DOCUMENTS)
  const [staff, setStaff] = React.useState<StaffUser[]>(STAFF)

  const value = React.useMemo<Store>(() => {
    return {
      leads,
      consultations,
      clients,
      cases,
      invoices,
      documents,
      staff,
      addLead: (input) => {
        const lead: Lead = {
          id: nextId("lead"),
          status: "new",
          qualification: "pending",
          createdAt: TODAY,
          lastActivity: TODAY,
          hierarchy: undefined,
          notes: undefined,
          ...input,
        }
        setLeads((prev) => [lead, ...prev])
        return lead
      },
      updateLead: (id, patch) => {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
      },
      convertLead: (id) => {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, status: "retained", qualification: "qualified" } : l,
          ),
        )
        setLeads((prev) => {
          const lead = prev.find((l) => l.id === id)
          if (lead) {
            const la = STAFF.find((u) => u.role === "legal_assistant")
            const client: Client = {
              id: nextId("client"),
              name: `${lead.firstName} ${lead.lastName}`,
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
          }
          return prev
        })
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
        return consultation
      },
      updateConsultation: (id, patch) => {
        setConsultations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      },
      updateCase: (id, patch) => {
        setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
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
        return doc
      },
      addStaff: (input) => {
        const user: StaffUser = {
          id: nextId("user"),
          initials: initialsOf(input.name),
          status: "invited",
          ...input,
        }
        setStaff((prev) => [...prev, user])
        return user
      },
      updateStaff: (id, patch) => {
        setStaff((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
      },
    }
  }, [leads, consultations, clients, cases, invoices, documents, staff])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
