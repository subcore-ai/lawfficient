-- Per-attorney calendar color (spec 13 calendar). A pastel chosen from a fixed app-side palette, used to
-- tint the attorney's calendar column + their consult blocks so attorneys are distinguishable at a glance.
-- The value is a palette KEY (e.g. 'rose'), app-validated; NULL = the default (uncolored).
--
-- No new RLS: the owner can already set non-privileged fields on their own profile (profiles_update_self,
-- 0001 — calendar_color is NOT in the guard_profile_privileges block), and admins write via the firm-scoped
-- service-role client gated on settings.manage, exactly like `schedulable` (0040).
alter table public.profiles add column if not exists calendar_color text;

-- Enforce a valid palette key at the DB layer too (defense in depth — the action validates as well).
-- KEEP THIS LIST IN SYNC with CALENDAR_COLORS in apps/app/lib/scheduling/calendar-colors.ts. Idempotent.
alter table public.profiles drop constraint if exists profiles_calendar_color_check;
alter table public.profiles add constraint profiles_calendar_color_check
  check (
    calendar_color is null
    or calendar_color in (
      'rose', 'pink', 'fuchsia', 'purple', 'violet', 'indigo', 'blue', 'sky',
      'cyan', 'teal', 'emerald', 'green', 'lime', 'amber', 'orange'
    )
  );
