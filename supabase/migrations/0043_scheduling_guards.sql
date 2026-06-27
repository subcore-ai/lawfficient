-- Scheduling integrity guards (spec 13, Phase 2). Two Postgres exclusion constraints enforce the rules
-- the slot engine + the app validate, but at the DATA layer — race-proof, where app checks can't be:
--   1. No double-booking: an attorney can't hold two overlapping active consultations.
--   2. No overlapping office hours: an attorney can't have two overlapping availability windows per day
--      (the availability-overlap guard deferred from #58 review).
-- Both need btree_gist for the scalar `=` columns (uuid / smallint). The availability guard also needs a
-- range over `time`, which Postgres doesn't ship — so we define one.

create extension if not exists btree_gist with schema extensions;

-- No double-booking. attorney_id is a profile id (globally unique → already firm-scoped), so we key on
-- it alone. The half-open [start, end) range means back-to-back consults (end == next start) don't
-- overlap. canceled / no_show + archived / unassigned don't occupy a slot. `completed` DOES block (the
-- safe default): a future consult marked completed early must not be double-bookable, and a past
-- completed never overlaps a future slot anyway. (Can't condition on past/future — now() isn't immutable.)
-- The end is computed by an IMMUTABLE helper. Both `start_at + interval` and `extract(epoch …)` are
-- generically STABLE (an index expression rejects them) because day/month intervals + most date_part
-- fields depend on the session timezone. A pure MINUTES interval, though, is tz-independent, so a
-- deterministic wrapper marked immutable is both truthful and index-safe.
create or replace function public.consultation_end(p_start timestamptz, p_duration_min int)
returns timestamptz
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_start + make_interval(mins => p_duration_min)
$$;

alter table public.consultations
  add constraint consultations_no_overlap
  exclude using gist (
    attorney_id with =,
    tstzrange(start_at, public.consultation_end(start_at, duration_min)) with &&
  )
  where (attorney_id is not null and not archived and status not in ('canceled', 'no_show'));

-- No overlapping office-hours windows for the same attorney + weekday (adjacent windows are fine).
-- Each window is an int4range of SECONDS-of-day (exact — no sub-minute truncation): extract(epoch from
-- `time`) is immutable (`time` has no timezone) and int4range carries its own GiST support. This avoids
-- a custom range type, whose auto-generated multirange constructor would trip the mutable-search_path
-- linter. (A day fits in int4: 86399 max.)
alter table public.attorney_availability
  add constraint attorney_availability_no_overlap
  exclude using gist (
    firm_id with =,
    attorney_id with =,
    weekday with =,
    int4range((extract(epoch from start_time))::int, (extract(epoch from end_time))::int) with &&
  );
