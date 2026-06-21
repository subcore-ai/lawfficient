# Backlog — deferred items

Parking lot for work we've consciously chosen **not** to do yet but want to remember.
Capture is cheap here; this is a meta-file (like `_parallel-plan.md` / `_template.md`),
version-controlled and greppable.

**Convention:** keep an item in one place at a time. Park "someday" ideas here; when one
becomes "we're doing this soon," promote it to a GitHub issue (label `enhancement` /
`tech-debt` / the relevant module) so it can be triaged, linked to a PR, and closed on
merge. Delete the entry here when it's promoted or done.

---

## RBAC — instant permission propagation (no logout)

_Added 2026-06-21._

**What:** make role/permission changes take effect on save, without the affected user
having to log out and back in.

**Why deferred:** the data-driven RBAC design ([25-rbac.md](25-rbac.md)) stamps permissions into the
JWT at token issuance, so a change applies on the user's next token refresh — not
instantly. Acceptable for an internal staff tool now; revisit when "applies on save" is
wanted.

**Options:**
- _Stopgap (config, minutes):_ shorten the access-token TTL so clients auto-refresh more
  often → changes self-apply within the TTL. No code.
- _Real fix (~1–2 days):_ force the affected user's token to refresh on save — either a
  Supabase Realtime nudge the client reacts to with `refreshSession()`, or a
  `permissions_updated_at` stamp the Next proxy checks to force-refresh on the user's
  next request (also catches offline / multi-device sessions — but the proxy route adds a
  per-request read of the stamp, so piggyback it on an existing query rather than a new
  round-trip). `refreshSession()` re-runs `custom_access_token_hook`, so the new token
  rebuilds the permission union for free.
  Per-user (assigning roles) ≈ 1 day; role-matrix fan-out (one edit touches every holder)
  adds ≈ 1 day.

**Caveat:** matters mainly for _revoking_ access — a stale token keeps access until it
refreshes. For hard/immediate revocation also `auth.admin.signOut(userId)` (forces
re-login). Granting new access is pure UX, no risk.

**Depends on:** access-token hook live (done); ideally land the `profiles.role` retirement
first so it's built on the final shape.

---

## Security — `billing.view_status` exposes full invoice rows

_Added 2026-06-21 (surfaced in the #21 review)._

**What:** the `invoices_select` RLS policy grants **full row** access to `billing.view_status`
holders (file clerks), but the intent is **status-only** — they should see payment status,
never amounts. A direct API/SQL query returns every column; only the UI redacts amounts (the
`0014` policy comment literally says "amount redaction stays a UI concern").

**Fix:** a status-only view/RPC that `billing.view_status` holders query instead of the base
table, or column-level grants restricting them to the status columns. Pre-dates the RBAC
fallback work — out of scope for that, but a real data-exposure.

**Priority:** do before onboarding any firm whose file clerks must not see invoice amounts.
