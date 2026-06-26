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
    supabase.from("leads").select("id, first_name, last_name, archived").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name, status").order("name"),
  ])
  // Fail fast on any read — a swallowed leads/profiles error would render with empty name maps
  // ("Unknown lead", blank attorneys) and unusable pickers instead of surfacing the failure.
  if (consultRes.error) throw consultRes.error
  if (leadsRes.error) throw leadsRes.error
  if (staffRes.error) throw staffRes.error

  const allLeads = leadsRes.data ?? []
  const allProfiles = staffRes.data ?? []
  // Name maps resolve EVERY referenced record (incl. archived leads / inactive attorneys) so a consult
  // never shows "Unknown lead" or a blank attorney just because they're no longer active.
  const leadNames = new Map(allLeads.map((l) => [l.id, `${l.first_name} ${l.last_name}`.trim()]))
  const profileNames = new Map(allProfiles.map((p) => [p.id, p.name]))
  // Pickers offer only the currently-bookable options: non-archived leads, active staff.
  const leadOptions: Option[] = allLeads
    .filter((l) => !l.archived)
    .map((l) => ({ id: l.id, name: `${l.first_name} ${l.last_name}`.trim() }))
  const attorneys: Option[] = allProfiles.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }))

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
