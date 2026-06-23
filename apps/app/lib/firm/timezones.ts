// Firm default time-zone options (Settings → General). Stored as IANA ids so the value is
// future-proof for real time-zone math; the label is the familiar "GMT offset + zone + US city"
// format (à la Google Calendar). NOTE: the GMT offsets are STANDARD time and don't track daylight
// saving — don't "correct" them per season. Extend for non-US firms / territories as needed.
export const FIRM_TIMEZONES = [
  { value: "America/New_York", label: "(GMT-05:00) Eastern Time — New York" },
  { value: "America/Chicago", label: "(GMT-06:00) Central Time — Chicago" },
  { value: "America/Denver", label: "(GMT-07:00) Mountain Time — Denver" },
  { value: "America/Phoenix", label: "(GMT-07:00) Mountain Time — Phoenix (no DST)" },
  { value: "America/Los_Angeles", label: "(GMT-08:00) Pacific Time — Los Angeles" },
  { value: "America/Anchorage", label: "(GMT-09:00) Alaska Time — Anchorage" },
  { value: "Pacific/Honolulu", label: "(GMT-10:00) Hawaii Time — Honolulu" },
] as const

export type FirmTimezone = (typeof FIRM_TIMEZONES)[number]["value"]

const VALUES = new Set<string>(FIRM_TIMEZONES.map((t) => t.value))
export function isFirmTimezone(value: string): boolean {
  return VALUES.has(value)
}
