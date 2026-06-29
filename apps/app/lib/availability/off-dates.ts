import "server-only"

import type { OffDateRange } from "@/lib/availability/exceptions"
import type { createClient } from "@/lib/supabase/server"

// Upcoming off-date ranges per attorney (their own time off + every firm-wide holiday, which closes the
// date for all), keyed by attorney id. Feeds the booking/edit date pickers so they gray out days an
// attorney is fully off. One query; shared by the consultations page (header "Book" dialog + calendar
// pickers) and the edit dialog's loader.
export async function loadOffDatesByAttorney(
  supabase: Awaited<ReturnType<typeof createClient>>,
  attorneyIds: string[],
  today: string,
): Promise<Record<string, OffDateRange[]>> {
  const byAttorney: Record<string, OffDateRange[]> = {}
  if (attorneyIds.length === 0) return byAttorney
  const { data, error } = await supabase
    .from("availability_exceptions")
    .select("attorney_id, start_date, end_date")
    .or(`attorney_id.in.(${attorneyIds.join(",")}),attorney_id.is.null`)
    .gte("end_date", today)
  if (error) throw error
  const firmHolidays = (data ?? [])
    .filter((e) => e.attorney_id === null)
    .map((e) => ({ startDate: e.start_date, endDate: e.end_date }))
  for (const id of attorneyIds) {
    const own = (data ?? [])
      .filter((e) => e.attorney_id === id)
      .map((e) => ({ startDate: e.start_date, endDate: e.end_date }))
    byAttorney[id] = [...firmHolidays, ...own]
  }
  return byAttorney
}
