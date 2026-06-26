import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import { ConsultationsBoard } from "@/components/consultations/consultations-board"
import { PageHeader } from "@/components/page-header"
import { getCurrentUser } from "@/lib/auth/session"
import { mapConsultationRow, partitionConsultations, type ConsultationView } from "@/lib/consultations/queries"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Consultations" }

type Option = { id: string; name: string }
type Loaded = {
  upcoming: ConsultationView[]
  past: ConsultationView[]
  leads: Option[]
  attorneys: Option[]
  canManage: boolean
}

async function load(): Promise<Loaded> {
  if (!isSupabaseConfigured()) {
    return { upcoming: [], past: [], leads: [], attorneys: [], canManage: false }
  }
  const me = await getCurrentUser()
  const supabase = await createClient()
  // Consultations are per-record (RLS client). Leads (for the picker + name map) and active staff (for
  // the attorney picker + name map) are firm reference data.
  const [consultRes, leadsRes, staffRes] = await Promise.all([
    supabase.from("consultations").select("*").eq("archived", false).order("start_at", { ascending: false }),
    supabase.from("leads").select("id, first_name, last_name").eq("archived", false).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name").eq("status", "active").order("name"),
  ])
  if (consultRes.error) throw consultRes.error

  const leadOptions: Option[] = (leadsRes.data ?? []).map((l) => ({
    id: l.id,
    name: `${l.first_name} ${l.last_name}`.trim(),
  }))
  const attorneys: Option[] = (staffRes.data ?? []).map((p) => ({ id: p.id, name: p.name }))
  const leadNames = new Map(leadOptions.map((l) => [l.id, l.name]))
  const profileNames = new Map(attorneys.map((p) => [p.id, p.name]))

  const views = (consultRes.data ?? []).map((r) => mapConsultationRow(r, leadNames, profileNames))
  const { upcoming, past } = partitionConsultations(views, new Date().toISOString())

  return {
    upcoming,
    past,
    leads: leadOptions,
    attorneys,
    canManage: me?.permissions?.includes("consultations.edit") ?? false,
  }
}

export default async function ConsultationsPage() {
  const { upcoming, past, leads, attorneys, canManage } = await load()
  return (
    <>
      <PageHeader title="Consultations" description="Book and manage consultations across attorney calendars.">
        {canManage ? <BookConsultationDialog leads={leads} attorneys={attorneys} /> : null}
      </PageHeader>
      <ConsultationsBoard upcoming={upcoming} past={past} canManage={canManage} />
    </>
  )
}
