import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight, CalendarClock } from "lucide-react"

import { ConsultationActions } from "@/components/consultations/consultation-actions"
import { StatusPill } from "@/components/status-pill"
import { getCurrentUser } from "@/lib/auth/session"
import { consultationStatusMeta, mapConsultationRow } from "@/lib/consultations/queries"
import { formatConsultationWhen } from "@/lib/consultations/time"
import { formatCurrency } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Consultation" }

// Load one consultation, firm-scoped by RLS (which also enforces consultations.view — a user without it,
// or a consult from another firm / that doesn't exist, all resolve to null → notFound). Names are resolved
// the same way the list does: the consult's lead + the firm's profiles (for attorney + booked-by).
async function load(id: string) {
  const me = await getCurrentUser()
  if (!me) return null
  const supabase = await createClient()

  const consultRes = await supabase.from("consultations").select("*").eq("id", id).maybeSingle()
  if (consultRes.error) throw consultRes.error
  if (!consultRes.data) return null
  const row = consultRes.data

  const [leadRes, staffRes] = await Promise.all([
    row.lead_id
      ? supabase.from("leads").select("id, first_name, last_name").eq("id", row.lead_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("profiles").select("id, name"),
  ])
  if (leadRes.error) throw leadRes.error
  if (staffRes.error) throw staffRes.error

  const leadNames = new Map(
    leadRes.data ? [[leadRes.data.id, `${leadRes.data.first_name} ${leadRes.data.last_name}`.trim()]] : [],
  )
  const profileNames = new Map((staffRes.data ?? []).map((p) => [p.id, p.name]))
  const consult = mapConsultationRow(row, leadNames, profileNames)

  return {
    consult,
    bookedByName: consult.bookedById ? (profileNames.get(consult.bookedById) ?? null) : null,
    canManage: me.permissions?.includes("consultations.edit") ?? false,
  }
}

// A labelled detail row inside the definition list (dt in column 1, dd in column 2).
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

export default async function ConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await load(id)
  if (!data) notFound()
  const { consult, bookedByName, canManage } = data
  const meta = consultationStatusMeta(consult.status)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link
        href="/consultations"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Consultations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{consult.leadName}</h1>
            <StatusPill label={meta.label} tone={meta.tone} dot />
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">{consult.type}</p>
        </div>
        {canManage ? (
          <ConsultationActions consultationId={consult.id} status={consult.status} outcome={consult.outcome} />
        ) : null}
      </div>

      <div className="rounded-lg border">
        <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-[7rem_1fr]">
          <Row label="When">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="text-muted-foreground size-3.5 shrink-0" />
              {formatConsultationWhen(consult.startAt, consult.timeZone)}
            </span>
          </Row>
          <Row label="Duration">{consult.durationMin} min</Row>
          <Row label="Attorney">
            {consult.attorneyName ?? <span className="text-muted-foreground">Unassigned</span>}
          </Row>
          <Row label="Lead">
            {consult.leadId ? (
              <Link href={`/leads/${consult.leadId}`} className="inline-flex items-center gap-1 hover:underline">
                {consult.leadName}
                <ArrowUpRight className="size-3.5 shrink-0" />
              </Link>
            ) : (
              consult.leadName
            )}
          </Row>
          <Row label="Payment">
            {consult.amount != null ? (
              <span className="tabular-nums">
                {formatCurrency(consult.amount)} · {consult.paid ? "Paid" : "Unpaid"}
              </span>
            ) : (
              <span className="text-muted-foreground">No fee</span>
            )}
          </Row>
          {consult.outcome ? (
            <Row label="Outcome">
              <span className="break-words">{consult.outcome}</span>
            </Row>
          ) : null}
          {bookedByName ? <Row label="Booked by">{bookedByName}</Row> : null}
        </dl>
      </div>
    </div>
  )
}
