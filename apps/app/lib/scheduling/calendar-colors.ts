// The fixed pastel palette an attorney's calendar can use (spec 13). The profile stores a stable KEY
// (migration 0045); rendering maps it to hex here. `tint` shades the office-hours column background,
// `solid` fills the consult blocks, `text` is the readable foreground on `solid`. Tailwind can't
// purge-safely build classes from a DB value, so the calendar applies these via inline styles.

export type CalendarColor = {
  key: string
  name: string
  tint: string // light pastel — office-hours column shading
  solid: string // consult block fill
  text: string // text on `solid`
}

export const CALENDAR_COLORS: CalendarColor[] = [
  { key: "rose", name: "Rose", tint: "#ffe4e6", solid: "#fda4af", text: "#881337" },
  { key: "pink", name: "Pink", tint: "#fce7f3", solid: "#f9a8d4", text: "#831843" },
  { key: "fuchsia", name: "Fuchsia", tint: "#fae8ff", solid: "#f0abfc", text: "#701a75" },
  { key: "purple", name: "Purple", tint: "#f3e8ff", solid: "#d8b4fe", text: "#581c87" },
  { key: "violet", name: "Violet", tint: "#ede9fe", solid: "#c4b5fd", text: "#4c1d95" },
  { key: "indigo", name: "Indigo", tint: "#e0e7ff", solid: "#a5b4fc", text: "#312e81" },
  { key: "blue", name: "Blue", tint: "#dbeafe", solid: "#93c5fd", text: "#1e3a8a" },
  { key: "sky", name: "Sky", tint: "#e0f2fe", solid: "#7dd3fc", text: "#0c4a6e" },
  { key: "cyan", name: "Cyan", tint: "#cffafe", solid: "#67e8f9", text: "#164e63" },
  { key: "teal", name: "Teal", tint: "#ccfbf1", solid: "#5eead4", text: "#134e4a" },
  { key: "emerald", name: "Emerald", tint: "#d1fae5", solid: "#6ee7b7", text: "#064e3b" },
  { key: "green", name: "Green", tint: "#dcfce7", solid: "#86efac", text: "#14532d" },
  { key: "lime", name: "Lime", tint: "#ecfccb", solid: "#bef264", text: "#365314" },
  { key: "amber", name: "Amber", tint: "#fef3c7", solid: "#fcd34d", text: "#78350f" },
  { key: "orange", name: "Orange", tint: "#ffedd5", solid: "#fdba74", text: "#7c2d12" },
]

const BY_KEY = new Map(CALENDAR_COLORS.map((c) => [c.key, c]))

// The palette entry for a stored key, or null when unset / unknown (→ the calendar's default styling).
export function colorFor(key: string | null | undefined): CalendarColor | null {
  return key ? (BY_KEY.get(key) ?? null) : null
}

export function isValidColorKey(key: string): boolean {
  return BY_KEY.has(key)
}
