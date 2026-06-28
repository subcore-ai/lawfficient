// Public-API scopes (spec 26). Kept in a PLAIN module — NOT the "use server" actions file — because a
// server-action module may only export async functions; a const/type exported from there doesn't reach
// client components as its real value (it arrives as a server reference). Both the server actions and
// the client editor import these from here.
export const API_SCOPES = [
  "leads:read",
  "leads:write",
  "consultations:read",
  "consultations:write",
] as const
export type ApiScope = (typeof API_SCOPES)[number]
