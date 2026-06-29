-- Make api_validate_booking (0049) callable by the in-app booking actions, so the staff-platform
-- create/reschedule path enforces the EXACT SAME office-hours / time-off / holiday rule the public API
-- already does — one rule, no drift, no office-hours logic duplicated in TypeScript.
--
-- 0049 defined the function SECURITY INVOKER and granted EXECUTE only to service_role (the API runs as
-- service_role with RLS off, so its reads always succeed). The in-app actions run under the user's RLS
-- session, where a consultations.edit user may NOT be able to read `profiles` (profiles is users.manage-
-- gated, migration 0017). Under INVOKER, the function's own `profiles` existence-check would then read
-- zero rows and wrongly raise `attorney_not_bookable` for a perfectly valid attorney.
--
-- Fix: switch to SECURITY DEFINER so the internal reads of profiles + attorney_availability +
-- availability_exceptions run with the function owner's privileges (not the caller's RLS), exactly like
-- the existing current_firm_id() / authorize() helpers in this schema. To keep that safe:
--   • search_path is pinned to '' (unchanged) so every reference stays schema-qualified.
--   • EXECUTE is REVOKEd from public and granted only to service_role + authenticated.
--   • A firm guard prevents a caller from passing a FOREIGN p_firm_id to probe another firm's calendar:
--     when there IS a user session (current_firm_id() is non-null), p_firm_id MUST equal it; the
--     service-role API path has no JWT so current_firm_id() is null and the guard is skipped (the API
--     already derives p_firm_id from the validated api_key, never from caller input).
-- This adds NO new advisor finding: the function-level linter flags a mutable search_path, which this
-- doesn't have; "SECURITY DEFINER callable by authenticated" is a VIEW rule, not a function rule (the
-- schema already ships current_firm_id/authorize the same way).
create or replace function public.api_validate_booking(
  p_firm_id uuid,
  p_attorney_id uuid,
  p_start timestamptz,
  p_duration_min int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_firm    uuid;
  v_tz             text;
  v_wall           timestamp;     -- the slot start as wall-clock time in the firm's timezone
  v_weekday        smallint;      -- 0=Sun..6=Sat (matches attorney_availability.weekday / JS getDay)
  v_start_seconds  int;           -- seconds-of-day of the slot start, firm-tz wall
  v_end_seconds    int;           -- seconds-of-day of the slot end, firm-tz wall
  v_date           date;          -- the slot's calendar date in the firm's timezone
begin
  -- Firm guard: with a user session, only the caller's OWN firm may be validated (SECURITY DEFINER reads
  -- bypass RLS, so without this a user could probe another firm's schedule by passing its id). The
  -- service-role API path has no JWT → current_firm_id() is null → guard skipped (it sets p_firm_id from
  -- the api_key, not from request input).
  v_caller_firm := public.current_firm_id();
  if v_caller_firm is not null and p_firm_id <> v_caller_firm then
    raise exception 'attorney_not_bookable' using errcode = 'check_violation';
  end if;

  -- Attorney must be schedulable + active + in this firm. (The composite FK on consultations already
  -- enforces firm membership at insert; this gives a precise, pre-insert error and adds the
  -- schedulable/active gate the in-app booking picker applies — who is bookable stays admin-controlled.)
  if not exists (
    select 1 from public.profiles p
    where p.id = p_attorney_id
      and p.firm_id = p_firm_id
      and p.schedulable
      and p.status = 'active'
  ) then
    raise exception 'attorney_not_bookable' using errcode = 'check_violation';
  end if;

  -- Firm timezone drives the wall-clock conversion (office hours are stored as naive wall `time` in it).
  select f.timezone into v_tz from public.firms f where f.id = p_firm_id;
  if v_tz is null then
    v_tz := 'America/New_York';
  end if;

  -- UTC instant → the firm's wall clock. `timestamptz AT TIME ZONE <tz>` yields a naive `timestamp`
  -- (the local clock in that zone), from which the weekday, seconds-of-day, and date are read.
  v_wall := p_start at time zone v_tz;
  v_weekday := extract(dow from v_wall)::smallint;
  v_start_seconds := (extract(epoch from v_wall::time))::int;
  v_end_seconds := v_start_seconds + p_duration_min * 60;
  v_date := v_wall::date;

  -- The slot's date must not be removed by an exception: the attorney's own time off, OR a firm-wide
  -- holiday (attorney_id IS NULL closes the date for everyone). A full-day exception drops the WHOLE day.
  if exists (
    select 1 from public.availability_exceptions e
    where e.firm_id = p_firm_id
      and (e.attorney_id = p_attorney_id or e.attorney_id is null)
      and v_date between e.start_date and e.end_date
  ) then
    raise exception 'attorney_unavailable' using errcode = 'check_violation';
  end if;

  -- The slot must fit ENTIRELY inside ONE office-hours window for that weekday (back-to-back windows
  -- don't combine — mirrors the slot engine, which never spans two windows or crosses midnight). A
  -- midnight-crossing slot has v_end_seconds > 86400 and fits no same-weekday window → correctly rejected.
  if not exists (
    select 1 from public.attorney_availability a
    where a.firm_id = p_firm_id
      and a.attorney_id = p_attorney_id
      and a.weekday = v_weekday
      and (extract(epoch from a.start_time))::int <= v_start_seconds
      and (extract(epoch from a.end_time))::int >= v_end_seconds
  ) then
    raise exception 'outside_office_hours' using errcode = 'check_violation';
  end if;
end;
$$;

-- Re-assert EXECUTE grants now that the function is SECURITY DEFINER: only service_role (API) + the
-- signed-in app session (authenticated) may call it; never anonymous/public. The firm guard above keeps
-- an authenticated caller confined to their own firm.
revoke all on function public.api_validate_booking(uuid, uuid, timestamptz, int) from public;
grant execute on function public.api_validate_booking(uuid, uuid, timestamptz, int) to service_role, authenticated;
