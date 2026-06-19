import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

// Next.js 16 renamed the `middleware` convention to `proxy` (same capabilities,
// defaults to the Node.js runtime). See node_modules/next/dist/docs →
// 01-app/.../file-conventions/proxy.md.
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Run on all routes except static assets and image optimization files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
