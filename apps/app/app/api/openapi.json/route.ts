import { NextResponse } from "next/server"

import { openapiDocument } from "@/lib/api/openapi"

// Serve the committed OpenAPI 3.1 contract (spec 26) read-only at GET /api/openapi.json. Static —
// no auth, no request data — so it can be prerendered.
export const dynamic = "force-static"

export function GET() {
  return NextResponse.json(openapiDocument)
}
