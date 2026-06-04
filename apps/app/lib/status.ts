// Maps domain enums to display label + semantic tone for <StatusPill>.
import type { Tone } from "@/components/status-pill"
import { LEAD_STATUS_LABELS } from "@/data"
import type {
  CaseStatus,
  CaseTask,
  Client,
  ConsultationStatus,
  Deadline,
  Invoice,
  Lead,
  Qualification,
  RedFlag,
} from "@/data/types"

export type Badge = { label: string; tone: Tone }

export function leadStatusBadge(s: Lead["status"]): Badge {
  const tone: Record<Lead["status"], Tone> = {
    new: "info",
    contacted: "info",
    consult_scheduled: "purple",
    scheduled_paid: "purple",
    qualified_followup: "warning",
    ea_sent: "warning",
    retained: "success",
    not_qualified: "neutral",
    lost: "neutral",
  }
  return { label: LEAD_STATUS_LABELS[s], tone: tone[s] }
}

export function qualificationBadge(q: Qualification): Badge {
  const map: Record<Qualification, Badge> = {
    qualified: { label: "Qualified", tone: "success" },
    not_qualified: { label: "Not qualified", tone: "neutral" },
    pending: { label: "Pending", tone: "warning" },
  }
  return map[q]
}

export function consultationStatusBadge(s: ConsultationStatus): Badge {
  const map: Record<ConsultationStatus, Badge> = {
    scheduled: { label: "Scheduled", tone: "info" },
    paid: { label: "Paid", tone: "success" },
    completed: { label: "Completed", tone: "neutral" },
    rescheduled: { label: "Rescheduled", tone: "warning" },
    canceled: { label: "Canceled", tone: "danger" },
    no_show: { label: "No-show", tone: "danger" },
  }
  return map[s]
}

export function caseStatusBadge(s: CaseStatus): Badge {
  const map: Record<CaseStatus, Badge> = {
    onboarding: { label: "Onboarding", tone: "info" },
    packet_prep: { label: "Packet prep", tone: "purple" },
    in_review: { label: "In review", tone: "warning" },
    filed: { label: "Filed", tone: "success" },
    rfe: { label: "RFE / NOID", tone: "danger" },
    approved: { label: "Approved", tone: "success" },
  }
  return map[s]
}

export function redFlagBadge(r: RedFlag): Badge | null {
  if (r === "none") return null
  return r === "red_flag_client"
    ? { label: "Red Flag Client", tone: "danger" }
    : { label: "Red Flag Packet", tone: "danger" }
}

export function invoiceStatusBadge(s: Invoice["status"]): Badge {
  const map: Record<Invoice["status"], Badge> = {
    draft: { label: "Draft", tone: "neutral" },
    sent: { label: "Sent", tone: "info" },
    partial: { label: "Partial", tone: "warning" },
    paid: { label: "Paid", tone: "success" },
    overdue: { label: "Overdue", tone: "danger" },
    void: { label: "Void", tone: "neutral" },
  }
  return map[s]
}

export function clientStatusBadge(s: Client["status"]): Badge {
  const map: Record<Client["status"], Badge> = {
    active: { label: "Active", tone: "success" },
    monthly_plan: { label: "Monthly plan", tone: "info" },
    on_hold: { label: "On hold", tone: "warning" },
    completed: { label: "Completed", tone: "neutral" },
    terminated: { label: "Terminated", tone: "danger" },
  }
  return map[s]
}

export function paymentStatusBadge(s: Client["paymentStatus"]): Badge {
  const map: Record<Client["paymentStatus"], Badge> = {
    current: { label: "Current", tone: "success" },
    overdue: { label: "Overdue", tone: "danger" },
    paid: { label: "Paid in full", tone: "neutral" },
    payment_arrangement: { label: "Arrangement", tone: "warning" },
  }
  return map[s]
}

export function priorityBadge(p: CaseTask["priority"]): Badge {
  const map: Record<CaseTask["priority"], Badge> = {
    low: { label: "Low", tone: "neutral" },
    normal: { label: "Normal", tone: "info" },
    high: { label: "High", tone: "warning" },
    urgent: { label: "Urgent", tone: "danger" },
  }
  return map[p]
}

export function deadlineBadge(d: Deadline): Badge {
  if (d.status === "overdue" || d.dueInDays < 0)
    return { label: `${Math.abs(d.dueInDays)}d overdue`, tone: "danger" }
  if (d.dueInDays <= 2) return { label: `Due in ${d.dueInDays}d`, tone: "danger" }
  if (d.dueInDays <= 7) return { label: `Due in ${d.dueInDays}d`, tone: "warning" }
  return { label: `Due in ${d.dueInDays}d`, tone: "info" }
}
