// The public API's single response envelope (spec 26). Errors are
// `{ "error": { "code": "snake_case", "message", "details"? } }` with the matching HTTP
// status; success bodies are returned verbatim. Route handlers build every response through
// these two helpers so the shape never drifts.
import { NextResponse } from "next/server"

import type { Json } from "@/lib/supabase/database.types"

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: Json
  }
}

export function apiError(code: string, message: string, status: number, details?: Json): NextResponse {
  const body: ApiErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } }
  return NextResponse.json(body, { status })
}

export function apiJson<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}
