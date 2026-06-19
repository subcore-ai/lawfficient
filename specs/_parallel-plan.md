# Parallel build plan — multi-agent fan-out

How to build this app fast with multiple agents without them colliding.

## The model

The whole frontend already exists on mock data (`apps/app/data/`). Building =
converting each feature's mock reads/writes to real Supabase, slice by slice.
The shared **contracts** (schema, RLS, auth, the `can()` matrix, domain types in
`apps/app/data/types.ts`) are frozen in Phase 0 so feature agents can run in
parallel against a stable foundation.

**Golden rule for every feature session:** stay inside your feature's folder.
Do **not** edit migrations, `packages/ui`, `apps/app/data/types.ts`, auth, or
another feature. If you need a shared change, stop and raise it against the
foundation — don't fork it.

## Phase 0 — foundation (DONE, do not re-do in parallel)

Multi-tenant schema + RLS (`supabase/`), `@supabase/ssr` clients +
middleware (`apps/app/lib/supabase/`), auth (`apps/app/app/(auth)/`), session
helpers + permission matrix (`apps/app/lib/auth/`). See `supabase/README.md`.

Gate before fan-out: project created, migrations applied, first admin user
exists, `database.types.ts` regenerated, login works end-to-end.

## Phase 1 — fan out: one web session per feature, each on its own branch

Open a Claude Code web session per row. Run waves in order (later waves depend
on earlier entities), but features **within** a wave run fully in parallel.

| Wave | Feature | Branch | Spec | Tables it owns |
|------|---------|--------|------|----------------|
| A | Consultations | `feat/consultations` | 13 | consultations |
| A | Case management | `feat/cases` | 15 | immigration_cases, deadlines, case_tasks |
| A | Billing | `feat/billing` | 17 | invoices |
| A | Documents | `feat/documents` | 16 | documents |
| B | Retention | `feat/retention` | 14 | (lead→client conversion, templates) |
| B | Communications | `feat/comms` | 19 | (notifications over all entities) |
| C | Reporting | `feat/reporting` | 20 | read-only aggregation |
| C | Dashboard | `feat/dashboard` | 11 | read-only aggregation |

Leads (spec 12) is the **reference slice** — build it first, solo, as the
worked example every other session copies. Admin/settings (22) is cross-cutting:
fold each settings page into the feature session that owns its data.

## Paste-ready brief template

> **Branch:** `feat/<name>` · **Scope:** <feature> only.
> The frontend exists at `apps/app/app/(app)/<route>/` on mock data. Convert it
> to real Supabase data, copying the **leads slice** (`apps/app/app/(app)/leads/`)
> as the exact pattern. Read `specs/<file>.md`. Use these tables: `<tables>`
> (already migrated — see `supabase/README.md`). Resolve the current user with
> `getCurrentUser()` from `@/lib/auth/session`; gate UI with `can()` from
> `@/lib/auth/permissions`. Fetch in Server Components, mutate via Server
> Actions. **Do not** touch migrations, `packages/ui`, `apps/app/data/types.ts`,
> auth, or other features — if you need a shared change, stop and flag it.
> Gate: `bun run typecheck && bun run lint && bun run build` all green. Open a
> PR; do not merge. Integrate via review so conflicts surface there, not in main.
