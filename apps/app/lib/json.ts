import type { Json } from "@/lib/supabase/database.types"

// Narrow a jsonb `Json` value to an object map, coercing anything that isn't a plain object
// (primitive, array, null, undefined) to `{}`. Returns the value itself when it's already an
// object — callers that need to mutate should spread it first.
export function jsonRecord(value: Json | null | undefined): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json>) : {}
}
