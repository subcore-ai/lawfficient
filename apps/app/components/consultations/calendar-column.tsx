"use client"

import { cn } from "@workspace/ui/lib/utils"

import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import type { CalendarColor } from "@/lib/scheduling/calendar-colors"
import { formatSlotTime, type CalendarConsult, type CalendarSlot, type CalendarWindow } from "@/lib/scheduling/day-calendar"

type Option = { id: string; name: string }

export const PX_PER_MIN = 0.9

// One attorney's day, as the BODY of a calendar column: office hours shaded, booked consults as blocks,
// free slots as click-to-book buttons. Absolutely positioned inside a `relative` parent and aligned to a
// SHARED `gridStartMin` so every column in the multi-attorney view lines up on the same hour lines.
export function CalendarColumn({
  windows,
  consults,
  slots,
  off,
  gridStartMin,
  attorneyId,
  typeName,
  leads,
  attorneys,
  consultationTypes,
  defaultTimeZone,
  canBook,
  color,
  onSelectConsult,
}: {
  windows: CalendarWindow[]
  consults: CalendarConsult[]
  slots: CalendarSlot[]
  off?: boolean // attorney is on time off this day → "Time off" banner, no slots
  gridStartMin: number
  attorneyId: string
  typeName: string
  leads: Option[]
  attorneys: Option[]
  consultationTypes: ConsultationType[]
  defaultTimeZone: string | null
  canBook: boolean
  color?: CalendarColor | null // the attorney's calendar color; tints office hours + consults + slots
  // Click a booked consult → the parent opens one shared detail dialog (keeps a single modal across columns).
  onSelectConsult: (c: CalendarConsult) => void
}) {
  const top = (min: number) => (min - gridStartMin) * PX_PER_MIN
  const height = (mins: number) => Math.max(mins * PX_PER_MIN, 16)
  // The attorney's color → inline tints that override the default brand classes. No color = default styling.
  // Office hours mix the color with the THEME background, so the shading is a light tint in light mode and a
  // dark tint in dark mode (a fixed pastel looked washed-out on dark). Slot text stays theme-aware; the
  // consult block is the opaque color with its own readable text (mode-independent).
  // Office-hours shading mixes the color with the theme bg; `--cal-office-tint` is the strength (30% light,
  // weaker in dark mode so the column stays dim).
  const officeTint = color ? { backgroundColor: `color-mix(in oklab, ${color.solid} var(--cal-office-tint), var(--background))` } : {}
  // Slots: a faint solid hairline in the color (calmer than dashed), and text that's a shade of the same
  // color mixed toward the theme foreground — dark on the light tint, light on the dark tint (not gray).
  const slotTint = color
    ? {
        // Border = the color at `--cal-slot-alpha` opacity (25% light, 15% dark) — fainter on dark so it
        // isn't bright. Text = a shade of the color toward the theme foreground (dark/light per mode).
        borderColor: `color-mix(in srgb, ${color.solid} var(--cal-slot-alpha), transparent)`,
        color: `color-mix(in oklab, ${color.solid} 45%, var(--foreground))`,
      }
    : {}
  const consultTint = color ? { backgroundColor: color.solid, color: color.text } : {}
  // To collapse the shared border between back-to-back slots into a single hairline: a slot whose end is
  // another slot's start drops its bottom border + bottom rounding (the next slot's top edge is the line).
  const slotStarts = new Set(slots.map((s) => s.startMin))
  const slotEnds = new Set(slots.map((s) => s.endMin))

  return (
    <>
      {off ? (
        <div className="text-muted-foreground bg-muted/40 absolute inset-x-0.5 top-1 z-10 rounded px-1.5 py-1 text-center text-[11px] font-medium">
          Time off
        </div>
      ) : null}

      {/* Office hours shading. */}
      {windows.map((w, i) => (
        <div
          key={`w-${i}`}
          className="bg-muted/50 absolute inset-x-0.5 rounded"
          style={{ top: top(w.startMin), height: height(w.endMin - w.startMin), ...officeTint }}
        />
      ))}

      {/* Free slots — click to book. */}
      {slots.map((s) => {
        const style = { top: top(s.startMin), height: height(s.endMin - s.startMin), ...slotTint }
        const label = formatSlotTime(s.startMin)
        const collapse = cn(
          slotStarts.has(s.endMin) && "rounded-b-none border-b-0",
          slotEnds.has(s.startMin) && "rounded-t-none",
        )
        if (!canBook) {
          return (
            <div
              key={s.startMs}
              className={cn(
                "border-primary/20 text-primary/70 absolute inset-x-0.5 overflow-hidden rounded border px-1.5 text-[11px] leading-tight",
                collapse,
              )}
              style={style}
            >
              {label}
            </div>
          )
        }
        return (
          <BookConsultationDialog
            key={s.startMs}
            leads={leads}
            attorneys={attorneys}
            consultationTypes={consultationTypes}
            defaultTimeZone={defaultTimeZone}
            prefillStart={s.startInput}
            prefillStartIso={new Date(s.startMs).toISOString()}
            prefillAttorneyId={attorneyId}
            prefillType={typeName}
            trigger={
              <button
                type="button"
                aria-label={`Book ${label}`}
                className={cn(
                  "border-primary/20 text-primary hover:bg-foreground/5 absolute inset-x-0.5 cursor-pointer overflow-hidden rounded border px-1.5 text-left text-[11px] leading-tight transition-colors",
                  collapse,
                )}
                style={style}
              >
                {label}
              </button>
            }
          />
        )
      })}

      {/* Booked consults — drawn over slots/shading; click opens the shared detail dialog. */}
      {consults.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelectConsult(c)}
          title={`${c.leadName} · ${c.type} · ${formatSlotTime(c.startMin)}`}
          className="bg-primary/85 text-primary-foreground absolute inset-x-0.5 cursor-pointer overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition-[filter] hover:brightness-95"
          style={{ top: top(c.startMin), height: height(c.endMin - c.startMin), ...consultTint }}
        >
          <span className="block truncate font-medium">{c.leadName}</span>
          <span className="block truncate opacity-80">{c.type}</span>
        </button>
      ))}
    </>
  )
}
