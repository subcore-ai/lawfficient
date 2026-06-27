import type { ReactNode } from "react"

import { toHm } from "@/lib/availability/queries"
import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import { CalendarControls } from "@/components/consultations/calendar-controls"
import { CalendarViewToggle } from "@/components/consultations/calendar-view-toggle"
import { ConsultationsBoard } from "@/components/consultations/consultations-board"
import { DayCalendar } from "@/components/consultations/day-calendar-grid"
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
// Cap simultaneous attorney columns so the day grid stays legible.
const MAX_COLUMNS = 6

// The current calendar date in the firm's zone, as YYYY-MM-DD (en-CA renders ISO-style).
function firmToday(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  }
}

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

  const [leadsRes, staffRes, firmRes, typesRes] = await Promise.all([
    supabase.from("leads").select("id, first_name, last_name, archived").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name, status, schedulable").order("name"),
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

  // Selected attorneys: ?attorneys=id1,id2,… → valid + schedulable, capped; default the first few.
  const requested =
    typeof sp.attorneys === "string" ? sp.attorneys.split(",") : Array.isArray(sp.attorneys) ? sp.attorneys : []
  const valid = requested.filter((id) => schedulable.some((a) => a.id === id))
  const selectedIds = (valid.length ? valid : schedulable.slice(0, 3).map((a) => a.id)).slice(0, MAX_COLUMNS)
  const date = typeof sp.date === "string" && isValidYmd(sp.date) ? sp.date : firmToday(zone)
  const selectedType = types.find((t) => t.name === sp.type) ?? types[0]!

  const dayEnd = zonedWallTimeToUtcISO(`${addDay(date)}T00:00`, zone)
  // Look back a day on the lower bound so a consult that STARTED yesterday but runs into this morning is
  // still subtracted from today's slots. buildDayCalendar shows only same-day-start consults but blocks on
  // all of them; 0043's exclusion constraint is the hard backstop regardless.
  const loadFrom = zonedWallTimeToUtcISO(`${addDay(date, -1)}T00:00`, zone)
  // One batched read per table across all selected attorneys, grouped by attorney below.
  const [availRes, dayConsultRes] = await Promise.all([
    supabase
      .from("attorney_availability")
      .select("attorney_id, start_time, end_time")
      .in("attorney_id", selectedIds)
      .eq("weekday", weekdayOf(date))
      .order("start_time"),
    loadFrom && dayEnd
      ? supabase
          .from("consultations")
          .select("id, attorney_id, start_at, duration_min, type, lead_id, status")
          .in("attorney_id", selectedIds)
          .eq("archived", false)
          .gte("start_at", loadFrom)
          .lt("start_at", dayEnd)
          .not("status", "in", "(canceled,no_show)")
      : Promise.resolve({ data: [], error: null }),
  ])
  // Fail loud: a swallowed error would render as "No office hours" or an empty/wrong slot grid.
  if (availRes.error) throw availRes.error
  if (dayConsultRes.error) throw dayConsultRes.error

  const nowMs = Date.now()
  const columns = selectedIds.map((id) => {
    const windows = (availRes.data ?? [])
      .filter((w) => w.attorney_id === id)
      .map((w) => ({ startTime: toHm(w.start_time), endTime: toHm(w.end_time) }))
    const consults = (dayConsultRes.data ?? [])
      .filter((c) => c.attorney_id === id)
      .map((c) => ({
        id: c.id,
        startAt: c.start_at,
        durationMin: c.duration_min,
        type: c.type,
        leadName: leadNames.get(c.lead_id ?? "") ?? "Lead",
        status: c.status ?? "",
      }))
    const cal = buildDayCalendar({ date, tz: zone, windows, consults, durationMin: selectedType.durationMin, nowMs })
    return { attorney: schedulable.find((a) => a.id === id)!, cal }
  })

  const anyHours = columns.some((c) => c.cal.windows.length > 0)

  return (
    <div className="space-y-4">
      <CalendarControls
        attorneys={schedulable}
        attorneyIds={selectedIds}
        date={date}
        today={firmToday(zone)}
        types={types}
        typeName={selectedType.name}
      />
      <div className="rounded-lg border p-4">
        {!anyHours ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No office hours set for the selected {columns.length > 1 ? "attorneys" : "attorney"} on this day.
          </p>
        ) : (
          <DayCalendar
            columns={columns}
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
