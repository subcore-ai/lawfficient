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

---

## Leads — list pagination + server-side pipeline counts

_Added 2026-06-22 (surfaced in the #22 review)._

**What:** the leads list (`app/(app)/leads/page.tsx`) loads every row with an unbounded
`select("*")` and filters/counts client-side over the loaded array. Past PostgREST's default
1000-row cap, a firm silently sees missing leads in the table AND wrong per-status count-strip
numbers. The dashboard KPIs already avoid this with `count` queries.

**Why deferred:** the approved plan chose client-side filtering over the loaded set for v1
(searchParams as the documented scale path); no firm has >1000 leads pre-launch.

**Fix:** server-side pagination (searchParams: page/status/source/search) + a per-status
`count` query (or a `lead_status_counts(firm)` RPC) for the strip, so both the list and the
counts stay correct at scale.

**Priority:** before any firm approaches ~1000 leads.

---

## Testing — RLS + server-action integration harness (local Supabase)

_Added 2026-06-22 (surfaced in the #27 notes review)._

**What:** an automated integration layer that exercises RLS policies, guard triggers, and server
actions against the local Supabase stack — seed via the service-role client, then assert allow/deny
as an `authenticated` JWT for a given firm/role. Locks in invariants the pure-logic unit tests can't
reach, e.g. "an editor can't insert a `kind='event'` note (forge activity)", "only the author or an
admin can delete a note", "a note's identity is immutable on update", "every table is firm-scoped".

**Why deferred:** today's `bun test` suite covers only pure logic (mappers/validators/parsers). The
RLS + actions + authorization layer — where the #27 review found the real bugs (event forgery,
ownership rewrite) — has no automated coverage; it's caught by review + preview e2e. A real harness
is a meatier setup (test-DB lifecycle, JWT minting per role) and must first resolve the **local
Data-API grant quirk** that blocks `authenticated` DML locally.

**Shape:** a `bun test` suite that (1) resets/seeds a local DB via service-role, (2) mints / signs in
`authenticated` users per firm + role, (3) asserts each policy + guard (`guard_notes`,
`guard_firm_taxonomy`, `guard_lead_status`, the leads / billing RLS). Runs locally + in CI.

**Promote when:** the security-sensitive surface grows (more entities adopt notes; billing/payments
land) — that's when locking RLS invariants in CI earns its keep.

---

## Leads — `updateLead` whole-`data` read-modify-write race (low importance)

_Added 2026-06-22 (declined cubic-P2 on the #28 review)._

**What:** `updateLead` (the Edit lead dialog's Save) updates `leads.data` (jsonb) by reading the
current blob, merging in memory, then writing the whole column back. A write that lands between the
read and the write is overwritten — a classic lost-update race. It applies to every `data` field; the
visible case is `qualification`, which now has a dedicated inline writer (`set_lead_qualification`),
so an inline change made during that window could be reverted.

**Why deferred:** #28 already shrank the window from the dialog-open→save span (seconds–minutes) to
the action's own read→write (sub-second), and there are no concurrent users at v1. It's a pre-existing,
generic jsonb read-modify-write pattern, not specific to that change.

**Fix:** do the `data` merge in the database — an RPC using `jsonb_set` / `||` so read+write are atomic
in one statement (mirrors the `set_lead_qualification` RPC, `0031`).

**Priority:** **Low.** Revisit only if multiple staff routinely edit the same lead concurrently.

---

## Scheduling — calendar fast-follows (after spec 13 Phase 5)

_Added 2026-06-27 (scoped out of the sellable scheduling core so each phase stayed shippable)._

**What:** Follow-ups to the consultation calendar (spec 13), each deliberately deferred:
- **Firm-wide holidays** — one entry that closes ALL attorneys (e.g. Christmas) instead of adding the date
  to every attorney's time off. Likely `availability_exceptions.attorney_id NULL` = firm-wide (admin-only
  RLS); the calendar/slot query unions per-attorney + firm-wide.
- **Partial-day overrides** — block part of a day (e.g. off 2–4pm) or change hours for a single date, not
  just full-day off. Today's `availability_exceptions` is whole-day only.
- **Private time-off labels** — an optional reason/label on a time-off entry ("Vacation", "Court"),
  visible to the owner + admins but NOT `consultations.view`. Dropped from v1 (the `note` column) because
  RLS is row-level and can't hide one column by app-permission, and booking staff (`consultations.view`)
  must read the row for the calendar's date-off check. Add back via a `security_invoker` view (note column
  excluded for non-admins) or a SECURITY DEFINER reader that returns only dates to `consultations.view`.
- **Booking rules** — per-firm **buffer** between consults, **minimum notice**, **maximum advance**; the
  slot engine (`generateSlots`) trims slots accordingly. (Spec 13 Phasing #5.)
- **Week view** — single-attorney 7-day grid (spec 13 lists it; only Day is built).

**Why deferred:** per-attorney full-day time off + the day calendar (single + multi-attorney) cover the
core "see availability, book a free slot, don't double-book, mark days off" value. These extend it but
aren't table-stakes for v1.

**Priority:** **Medium** (firm-wide holidays first — most-requested for real firms).
