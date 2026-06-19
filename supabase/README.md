# Supabase — Phase 0 foundation

This is the shared backend foundation. **Feature work depends on these contracts
— do not change the schema, RLS, or auth helpers in a feature branch. If a
feature needs a schema change, raise it against the foundation first.**

## What's here

- `migrations/0001_foundation.sql` — firms, profiles, pods, packet stages, enums,
  and the `current_firm_id()` / `current_staff_role()` scoping helpers.
- `migrations/0002_domain.sql` — leads, consultations, clients, cases, deadlines,
  tasks, invoices, documents, audit log. Mirrors `apps/app/data/types.ts`.
- `migrations/0003_domain_rls.sql` — strict `firm_id` isolation on every table.
- `migrations/0004_auth_triggers.sql` — auto-creates a profile on user signup
  from `app_metadata` (firm_id, role, name).
- `seed.sql` — the firm + default packet pipeline for local dev.

## Tenancy & security model

- Every row carries `firm_id`. RLS lets a user touch **only** their own firm's
  rows. This is the real enforcement; the app's `can()` matrix only hides UI.
- `firm_id` / `role` come from **`app_metadata`** (secret-key/service role only),
  never `user_metadata` (user-editable). Set them when you create/invite a user.
- Frontend uses the **publishable key** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`);
  server-only admin tasks use the **secret key** (`SUPABASE_SECRET_KEY`).
- `firm_id` **auto-defaults to `current_firm_id()`** on insert, so feature code
  doesn't have to set it (and the RLS `WITH CHECK` still blocks forging another
  firm's id). The service-role lead-ingestion path has no session, so it **must**
  set `firm_id` explicitly — resolve it from the API key/source mapping, never
  from the inbound payload.

### Assumption: one user = one firm

`profiles` is 1:1 with `auth.users` and carries a single `firm_id`. This is
correct for firm staff and keeps RLS simple. **If a user ever needs to belong to
multiple firms**, migrate like this:

1. Add a `memberships(user_id, firm_id, role)` table; backfill from `profiles`.
2. Add an "active firm" to the session — a JWT `app_metadata.firm_id` claim the
   user can switch between firms they're a member of.
3. Change `current_firm_id()` to read that claim instead of `profiles.firm_id`,
   and `current_staff_role()` to read the membership row for the active firm.
4. Drop the `firm_id` column from `profiles` (or keep it as "home firm").

RLS policies and the `firm_id`-on-every-table layout stay unchanged — only the
*resolution* of "which firm is this user acting as" moves into the claim.

## Bootstrap (once you have a project)

1. Put credentials in `apps/app/.env.local` (copy `apps/app/.env.example`).
2. Apply migrations + seed:
   ```bash
   bunx supabase db reset       # local
   # or: bunx supabase db push  # against a linked project
   ```
3. Create the first admin, attaching them to the seeded firm via `app_metadata`:
   ```bash
   # server-side / service role only
   supabase.auth.admin.createUser({
     email: "admin@chidoluelaw.com",
     password: "<temp>",
     email_confirm: true,
     app_metadata: {
       firm_id: "00000000-0000-0000-0000-000000000001",
       role: "admin",
       name: "Firm Admin",
     },
   })
   ```
4. Regenerate types (replaces the placeholder shim):
   ```bash
   bunx supabase gen types typescript --project-id <ref> \
     > apps/app/lib/supabase/database.types.ts
   ```

## Follow-up optimizations (not blocking)

- Move `firm_id`/`role` into a JWT claim via a custom access token hook so RLS
  reads `auth.jwt()` instead of the `current_firm_id()` lookup.
- Layer per-role column rules onto the firm-isolation baseline (e.g. File Clerk
  sees invoice status but not amounts) inside the billing slice.
