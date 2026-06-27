import { toHm } from "@/lib/availability/queries"
import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import { CalendarControls } from "@/components/consultations/calendar-controls"
import { CalendarViewToggle } from "@/components/consultations/calendar-view-toggle"
import { ConsultationsBoard } from "@/components/consultations/consultations-board"
import { DayCalendarGrid } from "@/components/consultations/day-calendar-grid"
import { PageHeader } from "@/components/page-header"
import { getCurrentUser } from "@/lib/auth/session"
import { mapConsultationTypeRow, type ConsultationType } from "@/lib/consultations/consultation-types"
import { mapConsultationRow, partitionConsultations } from "@/lib/consultations/queries"
import { zonedWallTimeToUtcISO } from "@/lib/consultations/time"
import { buildDayCalendar, weekdayOf } from "@/lib/scheduling/day-calendar"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Consultations" }

const DEFAULT_TZ = "America/New_York"

// The current calendar date in the firm's zone, as YYYY-MM-DD (en-CA renders ISO-style).
function firmToday(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  }
}

// Next calendar date (string math in UTC — only the Y-M-D matters).
function addDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

type Search = Record<string, string | string[] | undefined>

export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const view = sp.view === "calendar" ? "calendar" : "list"

  if (!isSupabaseConfigured()) {
    return (
      <>
        <PageHeader title="Consultations" description="Book and manage consultations across attorney calendars." />
        <p className="text-muted-foreground text-sm">Connect Supabase to manage consultations.</p>
      </>
    )
  }

  const me = await getCurrentUser()
  const supabase = await createClient()
  const canManage = me?.permissions?.includes("consultations.edit") ?? false

  const [consultRes, leadsRes, staffRes, firmRes, typesRes] = await Promise.all([
    supabase.from("consultations").select("*").eq("archived", false).order("start_at", { ascending: false }),
    supabase.from("leads").select("id, first_name, last_name, archived").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name, status, schedulable").order("name"),
    supabase.from("firms").select("timezone").single(),
    supabase.from("consultation_types").select("*").eq("is_active", true).order("position").order("created_at"),
  ])
  if (consultRes.error) throw consultRes.error
  if (leadsRes.error) throw leadsRes.error
  if (staffRes.error) throw staffRes.error

  const allLeads = leadsRes.data ?? []
  const allProfiles = staffRes.data ?? []
  const leadNames = new Map(allLeads.map((l) => [l.id, `${l.first_name} ${l.last_name}`.trim()]))
  const profileNames = new Map(allProfiles.map((p) => [p.id, p.name]))
  const leadOptions = allLeads.filter((l) => !l.archived).map((l) => ({ id: l.id, name: `${l.first_name} ${l.last_name}`.trim() }))
  const attorneys = allProfiles.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }))
  const types: ConsultationType[] = typesRes.error ? [] : (typesRes.data ?? []).map(mapConsultationTypeRow)
  const tz = firmRes.data?.timezone ?? null

  const views = (consultRes.data ?? []).map((r) => mapConsultationRow(r, leadNames, profileNames))
  const { upcoming, past } = partitionConsultations(views, new Date().toISOString())

  return (
    <>
      <PageHeader title="Consultations" description="Book and manage consultations across attorney calendars.">
        {canManage ? (
          <BookConsultationDialog leads={leadOptions} attorneys={attorneys} consultationTypes={types} defaultTimeZone={tz} />
        ) : null}
      </PageHeader>

      <CalendarViewToggle view={view} />

      {view === "calendar" ? (
        await renderCalendar({ sp, supabase, allProfiles, leadNames, leadOptions, attorneys, types, tz, canManage })
      ) : (
        <ConsultationsBoard upcoming={upcoming} past={past} canManage={canManage} />
      )}
    </>
  )
}

type Option = { id: string; name: string }

async function renderCalendar({
  sp,
  supabase,
  allProfiles,
  leadNames,
  leadOptions,
  attorneys,
  types,
  tz,
  canManage,
}: {
  sp: Search
  supabase: Awaited<ReturnType<typeof createClient>>
  allProfiles: { id: string; name: string; status: string; schedulable: boolean }[]
  leadNames: Map<string, string>
  leadOptions: Option[]
  attorneys: Option[]
  types: ConsultationType[]
  tz: string | null
  canManage: boolean
}) {
  const zone = tz ?? DEFAULT_TZ
  const schedulable = allProfiles.filter((p) => p.status === "active" && p.schedulable).map((p) => ({ id: p.id, name: p.name }))

  if (schedulable.length === 0 || types.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        {schedulable.length === 0
          ? "No bookable attorneys yet. Mark a team member schedulable in Settings → Users, then set their office hours."
          : "No consultation types yet. Add one in Settings → Consultation types to start booking."}
      </p>
    )
  }

  const attorneyId = typeof sp.attorney === "string" && schedulable.some((a) => a.id === sp.attorney) ? sp.attorney : schedulable[0]!.id
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : firmToday(zone)
  const selectedType = types.find((t) => t.name === sp.type) ?? types[0]!

  const dayStart = zonedWallTimeToUtcISO(`${date}T00:00`, zone)
  const dayEnd = zonedWallTimeToUtcISO(`${addDay(date)}T00:00`, zone)
  const [availRes, dayConsultRes] = await Promise.all([
    supabase
      .from("attorney_availability")
      .select("start_time, end_time")
      .eq("attorney_id", attorneyId)
      .eq("weekday", weekdayOf(date))
      .order("start_time"),
    dayStart && dayEnd
      ? supabase
          .from("consultations")
          .select("id, start_at, duration_min, type, lead_id, status")
          .eq("attorney_id", attorneyId)
          .eq("archived", false)
          .gte("start_at", dayStart)
          .lt("start_at", dayEnd)
          .not("status", "in", "(canceled,no_show)")
      : Promise.resolve({ data: [], error: null }),
  ])

  const windows = (availRes.data ?? []).map((w) => ({ startTime: toHm(w.start_time), endTime: toHm(w.end_time) }))
  const dayConsults = (dayConsultRes.data ?? []).map((c) => ({
    id: c.id,
    startAt: c.start_at,
    durationMin: c.duration_min,
    type: c.type,
    leadName: leadNames.get(c.lead_id ?? "") ?? "Lead",
    status: c.status ?? "",
  }))
  const cal = buildDayCalendar({ date, tz: zone, windows, consults: dayConsults, durationMin: selectedType.durationMin, nowMs: Date.now() })

  return (
    <div className="space-y-4">
      <CalendarControls attorneys={schedulable} attorneyId={attorneyId} date={date} today={firmToday(zone)} types={types} typeName={selectedType.name} />
      <div className="rounded-lg border p-4">
        {windows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No office hours set for this day.</p>
        ) : (
          <DayCalendarGrid
            cal={cal}
            attorneyId={attorneyId}
            typeName={selectedType.name}
            leads={leadOptions}
            attorneys={attorneys}
            consultationTypes={types}
            defaultTimeZone={tz}
            canBook={canManage}
          />
        )}
      </div>
    </div>
  )
}
