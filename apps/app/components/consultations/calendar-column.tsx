"use client"

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
  const officeTint = color ? { backgroundColor: `color-mix(in oklab, ${color.solid} 30%, var(--background))` } : {}
  // Slot text is a shade of the SAME color, mixed toward the theme foreground — so it lands dark on the
  // light tint (light mode) and light on the dark tint (dark mode), and reads as the column's color, not gray.
  const slotTint = color
    ? { borderColor: color.solid, color: `color-mix(in oklab, ${color.solid} 45%, var(--foreground))` }
    : {}
  const consultTint = color ? { backgroundColor: color.solid, color: color.text } : {}

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
        if (!canBook) {
          return (
            <div
              key={s.startMs}
              className="border-primary/40 text-primary/70 absolute inset-x-0.5 overflow-hidden rounded border border-dashed px-1.5 text-[11px] leading-tight"
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
                className="border-primary/40 text-primary hover:bg-primary/10 absolute inset-x-0.5 cursor-pointer overflow-hidden rounded border border-dashed px-1.5 text-left text-[11px] leading-tight transition-colors"
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
