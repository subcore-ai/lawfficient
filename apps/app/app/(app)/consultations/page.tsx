import type { ReactNode } from "react"
import { cookies } from "next/headers"

import { toHm } from "@/lib/availability/queries"
import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import { CalendarBoard } from "@/components/consultations/calendar-board"
import { CalendarViewToggle } from "@/components/consultations/calendar-view-toggle"
import { ConsultationsBoard } from "@/components/consultations/consultations-board"
import { PageHeader } from "@/components/page-header"
import { getCurrentUser } from "@/lib/auth/session"
import { mapConsultationTypeRow, type ConsultationType } from "@/lib/consultations/consultation-types"
import { mapConsultationRow, partitionConsultations } from "@/lib/consultations/queries"
import { currentDateInZone, zonedWallTimeToUtcISO } from "@/lib/consultations/time"
import { colorFor } from "@/lib/scheduling/calendar-colors"
import { MAX_CALENDAR_COLUMNS, weekDatesOf } from "@/lib/scheduling/day-calendar"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Consultations" }

const DEFAULT_TZ = "America/New_York"

// Shift a calendar date by N days (string math in UTC — only the Y-M-D matters).
function addDay(date: string, n = 1): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// True only for a real calendar date — the regex alone would accept e.g. 2026-13-40, which would then
// desync weekdayOf() from the day-bounds query.
function isValidYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

type Search = Record<string, string | string[] | undefined>

export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  // Calendar is the default view; ?view=list opts into the status board.
  const view = sp.view === "list" ? "list" : "calendar"

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

  const [leadsRes, staffRes, firmRes, typesRes] = await Promise.all([
    supabase.from("leads").select("id, first_name, last_name, archived").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name, status, schedulable, calendar_color").order("name"),
    supabase.from("firms").select("timezone").single(),
    supabase.from("consultation_types").select("*").eq("is_active", true).order("position").order("created_at"),
  ])
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

  // The status board (list view) is the full consult list's only consumer — load it lazily so the
  // calendar view doesn't pay for an unfiltered scan + mapping it never renders.
  let board: ReactNode = null
  if (view === "list") {
    const consultRes = await supabase.from("consultations").select("*").eq("archived", false).order("start_at", { ascending: false })
    if (consultRes.error) throw consultRes.error
    const views = (consultRes.data ?? []).map((r) => mapConsultationRow(r, leadNames, profileNames))
    const { upcoming, past } = partitionConsultations(views, new Date().toISOString())
    board = <ConsultationsBoard upcoming={upcoming} past={past} canManage={canManage} />
  }

  return (
    <>
      <PageHeader title="Consultations" description="Book and manage consultations across attorney calendars.">
        {canManage ? (
          <BookConsultationDialog leads={leadOptions} attorneys={attorneys} consultationTypes={types} defaultTimeZone={tz} />
        ) : null}
      </PageHeader>

      <CalendarViewToggle view={view} />

      {view === "calendar"
        ? await renderCalendar({ sp, supabase, allProfiles, leadNames, leadOptions, attorneys, types, tz, canManage })
        : board}
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
  allProfiles: { id: string; name: string; status: string; schedulable: boolean; calendar_color: string | null }[]
  leadNames: Map<string, string>
  leadOptions: Option[]
  attorneys: Option[]
  types: ConsultationType[]
  tz: string | null
  canManage: boolean
}) {
  const zone = tz ?? DEFAULT_TZ
  const schedulable = allProfiles.filter((p) => p.status === "active" && p.schedulable).map((p) => ({ id: p.id, name: p.name }))
  const colorByAttorney = new Map(allProfiles.map((p) => [p.id, colorFor(p.calendar_color)]))

  if (schedulable.length === 0 || types.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        {schedulable.length === 0
          ? "No bookable attorneys yet. Mark a team member schedulable in Settings → Users, then set their office hours."
          : "No consultation types yet. Add one in Settings → Consultation types to start booking."}
      </p>
    )
  }

  // Picked calendars + the viewed day both come from cookies (CalendarBoard filters client-side; the day is
  // server-read so there's no flash). Validate + cap, default the first few. ALL schedulable calendars are
  // loaded below so toggling never hits the server.
  const cookieStore = await cookies()
  const saved = cookieStore.get("consultations.calendars")?.value
  const savedDate = cookieStore.get("consultations.calendarDate")?.value
  const requested = saved ? saved.split(".") : []
  const valid = Array.from(new Set(requested)).filter((id) => schedulable.some((a) => a.id === id))
  const initialSelected = (valid.length ? valid : schedulable.slice(0, 3).map((a) => a.id)).slice(0, MAX_CALENDAR_COLUMNS)
  const allIds = schedulable.map((a) => a.id)
  // Day precedence: an explicit ?date= (nav / shared link) wins, else the remembered day, else firm-today.
  const date =
    typeof sp.date === "string" && isValidYmd(sp.date)
      ? sp.date
      : savedDate && isValidYmd(savedDate)
        ? savedDate
        : currentDateInZone(zone)
  // The calendar slots default to the first active type's length; the actual type is chosen when booking.
  const selectedType = types[0]!

  // Load the whole week containing `date` so paging days within it is client-side (no re-fetch). One batched
  // read per table across all schedulable attorneys; grouped by attorney + weekday below.
  const weekDates = weekDatesOf(date)
  const weekStart = weekDates[0]!
  const weekLast = weekDates[6]!
  const weekEndUtc = zonedWallTimeToUtcISO(`${addDay(weekLast)}T00:00`, zone) // exclusive: the next Monday
  // Look back a day so a consult that STARTED the day before the week but carries into Monday morning still
  // subtracts from its slots. buildDayCalendar shows only same-day-start consults but blocks on all of them.
  const loadFrom = zonedWallTimeToUtcISO(`${addDay(weekStart, -1)}T00:00`, zone)
  const [availRes, weekConsultRes, offRes] = await Promise.all([
    supabase
      .from("attorney_availability")
      .select("attorney_id, weekday, start_time, end_time")
      .in("attorney_id", allIds)
      .order("start_time"),
    loadFrom && weekEndUtc
      ? supabase
          .from("consultations")
          .select("id, attorney_id, start_at, duration_min, type, lead_id, status, time_zone, outcome")
          .in("attorney_id", allIds)
          .eq("archived", false)
          .gte("start_at", loadFrom)
          .lt("start_at", weekEndUtc)
          .not("status", "in", "(canceled,no_show)")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("availability_exceptions")
      .select("attorney_id, start_date, end_date")
      // Per-attorney time off for the loaded attorneys + firm-wide holidays (attorney_id IS NULL).
      .or(`attorney_id.in.(${allIds.join(",")}),attorney_id.is.null`)
      .lte("start_date", weekLast)
      .gte("end_date", weekStart),
  ])
  // Fail loud: a swallowed error would render as "No office hours" or an empty/wrong slot grid.
  if (availRes.error) throw availRes.error
  if (weekConsultRes.error) throw weekConsultRes.error
  if (offRes.error) throw offRes.error

  const nowMs = Date.now()
  // Each schedulable attorney's whole week: office hours by weekday, the week's consults, and which dates are
  // off (time off). The browser builds the picked day's columns from this, so paging days never hits the DB.
  const attorneyWeeks = schedulable.map((a) => {
    const hoursByWeekday: Record<number, { startTime: string; endTime: string }[]> = {}
    for (const w of availRes.data ?? []) {
      if (w.attorney_id !== a.id) continue
      const list = (hoursByWeekday[w.weekday] ??= [])
      list.push({ startTime: toHm(w.start_time), endTime: toHm(w.end_time) })
    }
    const offDates = weekDates.filter((d) =>
      (offRes.data ?? []).some(
        (e) => (e.attorney_id === a.id || e.attorney_id === null) && e.start_date <= d && e.end_date >= d,
      ),
    )
    const consults = (weekConsultRes.data ?? [])
      .filter((c) => c.attorney_id === a.id)
      .map((c) => ({
        id: c.id,
        startAt: c.start_at,
        durationMin: c.duration_min,
        type: c.type,
        leadName: leadNames.get(c.lead_id ?? "") ?? "Lead",
        status: c.status,
        leadId: c.lead_id,
        timeZone: c.time_zone,
        outcome: c.outcome,
      }))
    return { attorney: a, color: colorByAttorney.get(a.id) ?? null, hoursByWeekday, offDates, consults }
  })

  return (
    <CalendarBoard
      attorneyWeeks={attorneyWeeks}
      weekDates={weekDates}
      initialSelected={initialSelected}
      date={date}
      tz={zone}
      slotDuration={selectedType.durationMin}
      slotTypeName={selectedType.name}
      nowMs={nowMs}
      leads={leadOptions}
      attorneys={attorneys}
      consultationTypes={types}
      canBook={canManage}
    />
  )
}
