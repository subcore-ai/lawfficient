// Normalize phone numbers to E.164 so dedup/resolution keys are consistent across sources.
// International numbers are the norm for an immigration firm, so this uses libphonenumber-js
// rather than a hand-rolled "assume US" formatter. Returns null when the input can't be parsed
// to a valid number; callers fall back to the raw string so nothing is lost.
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js"

export function toE164(value: unknown, defaultCountry: CountryCode = "US"): string | null {
  if (typeof value !== "string" || value.trim() === "") return null
  try {
    const parsed = parsePhoneNumberFromString(value, defaultCountry)
    return parsed && parsed.isValid() ? parsed.number : null
  } catch {
    return null
  }
}
