// PLACEHOLDER generated-types shim.
//
// Once the Supabase project is live and migrations are applied, regenerate the
// real types and replace this file:
//
//   bunx supabase gen types typescript --project-id <ref> > apps/app/lib/supabase/database.types.ts
//
// Until then this permissive shape keeps the typed clients compiling. It does
// NOT give per-column type safety — feature agents should regenerate before
// relying on query result types.
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: []
}

export type Database = {
  public: {
    Tables: Record<string, GenericTable>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
