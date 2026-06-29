-- Public consultations API (spec 13 + spec 26): the booking/reschedule/cancel write core, mirroring the
-- leads API's api_create_lead (0036). Two SECURITY INVOKER functions the service-role admin client calls
-- (no user session → RLS does not apply; EXECUTE is granted ONLY to service_role, so neither is a public
-- endpoint). Both enforce the SAME scheduling rules the in-app booking action does, but at the DATA layer
-- so they're race-proof and can't drift from a second surface:
--   • api_book_consultation — ATOMIC + idempotent (Idempotency-Key, exactly like api_create_lead).
--     Validates attorney (schedulable + active + in firm), lead (in firm), and that the requested slot
--     fits inside the attorney's office hours for that firm-timezone weekday and is NOT inside any
--     availability exception (the attorney's OR a firm-wide NULL holiday). The insert then trips the
--     0043 no-overlap exclusion constraint if the slot is already taken — caller maps 23P01 → a clean
--     "slot booked" conflict, never a 500.
--   • api_update_consultation — reschedule (new start/duration/attorney, RE-validated against the same
--     rules) and/or cancel (status → a terminal lifecycle value). Only a non-terminal consult can change.
--
-- NOTE on scopes: api_keys.scopes is a plain text[] (0034), NOT a Postgres enum, so the new
-- consultations:read / consultations:write scopes are added in TS (lib/api/scopes.ts) only — no enum
-- change belongs here.

-- ── Shared booking validation ────────────────────────────────────────────────────────────────────────
-- Asserts a consult of [p_start, p_start+duration) for p_attorney_id is bookable under p_firm_id's
-- calendar: the attorney is schedulable + active + in the firm, and the slot (expressed in the firm's
-- timezone wall clock) fits ENTIRELY within one of that attorney's office-hours windows for that weekday
-- AND the slot's date is not inside any availability exception (the attorney's own, or a firm-wide
-- attorney_id-NULL holiday). Mirrors lib/availability/slots.ts + buildDayCalendar exactly, in SQL.
--
-- Raises a descriptive exception (not just returns false) so the caller can surface WHICH rule failed as
-- a clean 4xx. SECURITY INVOKER + locked search_path; reads go through the service-role caller (RLS off).
create or replace function public.api_validate_booking(
  p_firm_id uuid,
  p_attorney_id uuid,
  p_start timestamptz,
  p_duration_min int
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tz             text;
  v_wall           timestamp;     -- the slot start as wall-clock time in the firm's timezone
  v_weekday        smallint;      -- 0=Sun..6=Sat (matches attorney_availability.weekday / JS getDay)
  v_start_seconds  int;           -- seconds-of-day of the slot start, firm-tz wall
  v_end_seconds    int;           -- seconds-of-day of the slot end, firm-tz wall
  v_date           date;          -- the slot's calendar date in the firm's timezone
begin
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

revoke all on function public.api_validate_booking(uuid, uuid, timestamptz, int) from public;
grant execute on function public.api_validate_booking(uuid, uuid, timestamptz, int) to service_role;

-- ── Idempotency table: support consultation creates too ───────────────────────────────────────────────
-- api_idempotency_keys (0036) keyed only leads. Generalize it to either resource: add a nullable
-- consultation_id alongside lead_id, and require EXACTLY ONE to be set so every key maps to one created
-- resource. Same cascade semantics: if the created consult is hard-deleted, its key goes with it (a retry
-- then legitimately re-books, since the original outcome no longer exists). Done BEFORE the booking
-- function so its INSERT into this table type-checks against the new column.
alter table public.api_idempotency_keys
  alter column lead_id drop not null,
  add column if not exists consultation_id uuid
    references public.consultations(id) on delete cascade;

alter table public.api_idempotency_keys
  drop constraint if exists api_idempotency_keys_one_target;
alter table public.api_idempotency_keys
  add constraint api_idempotency_keys_one_target
  check (num_nonnulls(lead_id, consultation_id) = 1);

-- ── Book a consultation (atomic + idempotent) ─────────────────────────────────────────────────────────
-- Mirrors api_create_lead (0036): inserts the consultation AND records its idempotency key in ONE
-- transaction when an Idempotency-Key is supplied, so a committed key always points at a real consult and
-- a failed booking rolls back leaving no reservation. Concurrent repeats serialize on the unique (firm,
-- key, idempotency_key) constraint; the losers replay the winner's consult (replayed=true → no second
-- consultation.booked event).
--
-- Validation runs BEFORE the insert via api_validate_booking (attorney/lead/office-hours/exceptions). The
-- 0043 exclusion constraint is the race-proof no-double-book guarantee: if the slot was taken between
-- validation and the insert, the insert raises 23P01 — which propagates to the caller as a clean conflict.
--
-- Nullable inputs (the idempotency pair) carry DEFAULT NULL so the generated TS type marks them optional.
create or replace function public.api_book_consultation(
  p_firm_id uuid,
  p_lead_id uuid,
  p_attorney_id uuid,
  p_type text,
  p_start_at timestamptz,
  p_duration_min int,
  p_time_zone text,
  p_paid boolean,
  p_amount numeric,
  p_data jsonb,
  p_api_key_id uuid default null,
  p_idempotency_key text default null
)
returns table (
  id uuid,
  firm_id uuid,
  lead_id uuid,
  attorney_id uuid,
  type text,
  status public.consultation_status,
  start_at timestamptz,
  duration_min int,
  time_zone text,
  paid boolean,
  amount numeric,
  outcome text,
  archived boolean,
  created_at timestamptz,
  last_activity timestamptz,
  data jsonb,
  replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing uuid; -- the consult a prior same-key request already booked (idempotent replay), else NULL
begin
  -- Lead must belong to this firm (precise pre-insert error; the composite FK backstops it).
  if not exists (
    select 1 from public.leads l where l.id = p_lead_id and l.firm_id = p_firm_id
  ) then
    raise exception 'lead_not_in_firm' using errcode = 'check_violation';
  end if;

  -- Attorney + slot rules (raises a labeled check_violation on any failure).
  perform public.api_validate_booking(p_firm_id, p_attorney_id, p_start_at, p_duration_min);

  if p_idempotency_key is not null then
    begin
      insert into public.consultations (
        firm_id, lead_id, attorney_id, type, start_at, duration_min, time_zone, paid, amount, data, status
      ) values (
        p_firm_id, p_lead_id, p_attorney_id, p_type, p_start_at, p_duration_min, p_time_zone,
        coalesce(p_paid, false), p_amount, coalesce(p_data, '{}'::jsonb), 'scheduled'
      ) returning consultations.id into v_id;

      insert into public.api_idempotency_keys (firm_id, api_key_id, idempotency_key, consultation_id)
      values (p_firm_id, p_api_key_id, p_idempotency_key, v_id);

      return query
        select c.id, c.firm_id, c.lead_id, c.attorney_id, c.type, c.status, c.start_at, c.duration_min,
               c.time_zone, c.paid, c.amount, c.outcome, c.archived, c.created_at, c.last_activity, c.data,
               false
        from public.consultations c
        where c.id = v_id;
      return;
    exception
      -- Two violations can roll back the insert above; both are resolved by "has THIS key already booked?":
      --   • unique_violation  — a concurrent same-key request won the api_idempotency_keys race (our
      --     consult inserted but the key insert collided).
      --   • exclusion_violation — the 0043 no-overlap guard rejected our consult. For an idempotent REPLAY
      --     this is expected (re-booking the SAME slot the original call already took); but it ALSO fires
      --     when a DIFFERENT booking holds the slot. Distinguish by the key: if THIS (firm, key) already
      --     committed, replay it; otherwise it's a genuine double-book → re-raise the conflict.
      when unique_violation or exclusion_violation then
        select c.id into v_existing
        from public.consultations c
        join public.api_idempotency_keys k on k.consultation_id = c.id
        where k.firm_id = p_firm_id
          and k.api_key_id = p_api_key_id
          and k.idempotency_key = p_idempotency_key;
        -- No prior record for this key → the conflict is a real slot clash, not a replay. Re-raise so the
        -- route returns a clean 409 (exactly as a non-idempotent double-book would).
        if v_existing is null then
          raise;
        end if;
        return query
          select c.id, c.firm_id, c.lead_id, c.attorney_id, c.type, c.status, c.start_at, c.duration_min,
                 c.time_zone, c.paid, c.amount, c.outcome, c.archived, c.created_at, c.last_activity,
                 c.data, true
          from public.consultations c
          where c.id = v_existing;
        return;
    end;
  end if;

  -- No Idempotency-Key: a plain booking.
  insert into public.consultations (
    firm_id, lead_id, attorney_id, type, start_at, duration_min, time_zone, paid, amount, data, status
  ) values (
    p_firm_id, p_lead_id, p_attorney_id, p_type, p_start_at, p_duration_min, p_time_zone,
    coalesce(p_paid, false), p_amount, coalesce(p_data, '{}'::jsonb), 'scheduled'
  ) returning consultations.id into v_id;

  return query
    select c.id, c.firm_id, c.lead_id, c.attorney_id, c.type, c.status, c.start_at, c.duration_min,
           c.time_zone, c.paid, c.amount, c.outcome, c.archived, c.created_at, c.last_activity, c.data, false
    from public.consultations c
    where c.id = v_id;
end;
$$;

revoke all on function public.api_book_consultation(
  uuid, uuid, uuid, text, timestamptz, int, text, boolean, numeric, jsonb, uuid, text
) from public;
grant execute on function public.api_book_consultation(
  uuid, uuid, uuid, text, timestamptz, int, text, boolean, numeric, jsonb, uuid, text
) to service_role;

-- ── Reschedule / cancel a consultation ────────────────────────────────────────────────────────────────
-- One atomic write for the two API mutations on an existing consult, gated to a NON-terminal one (a
-- finalized completed/canceled/no_show consult can't change — mirrors the in-app action's `.in()` guard):
--   • Reschedule: any of attorney / start / duration / time zone provided → re-validate the resulting
--     slot against the SAME booking rules, then update. The mover's status becomes 'rescheduled' unless
--     the same call also sets an explicit terminal status.
--   • Cancel (or other lifecycle move): p_status set to a terminal value → just the status changes.
-- NULL params mean "leave unchanged"; coalesce fills them from the current row so re-validation always
-- sees the effective slot. Returns the updated consult; the route maps it + decides which events to emit.
--
-- Errors: a no-such/finalized/other-firm consult → no row updated (the route returns 404 / 409). A bad
-- attorney trips api_validate_booking or the composite FK (clean 4xx). A taken slot trips 0043 (23P01).
create or replace function public.api_update_consultation(
  p_firm_id uuid,
  p_id uuid,
  p_attorney_id uuid default null,
  p_start_at timestamptz default null,
  p_duration_min int default null,
  p_time_zone text default null,
  p_status public.consultation_status default null,
  p_reschedule boolean default false
)
returns table (
  id uuid,
  firm_id uuid,
  lead_id uuid,
  attorney_id uuid,
  type text,
  status public.consultation_status,
  start_at timestamptz,
  duration_min int,
  time_zone text,
  paid boolean,
  amount numeric,
  outcome text,
  archived boolean,
  created_at timestamptz,
  last_activity timestamptz,
  data jsonb,
  replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cur          public.consultations%rowtype;
  v_attorney_id  uuid;
  v_start_at     timestamptz;
  v_duration     int;
  v_time_zone    text;
  v_status       public.consultation_status;
begin
  -- Lock + load the current row, firm-scoped and only if non-terminal. No row → the route 404/409s.
  select * into v_cur
  from public.consultations c
  where c.id = p_id
    and c.firm_id = p_firm_id
    and c.status in ('scheduled', 'paid', 'rescheduled')
  for update;
  if not found then
    return; -- not this firm's, doesn't exist, or already finalized
  end if;

  -- Effective values after the patch (NULL param = keep current).
  v_attorney_id := coalesce(p_attorney_id, v_cur.attorney_id);
  v_start_at    := coalesce(p_start_at, v_cur.start_at);
  v_duration    := coalesce(p_duration_min, v_cur.duration_min);
  v_time_zone   := coalesce(p_time_zone, v_cur.time_zone);

  -- A reschedule (slot/attorney touched) re-validates the resulting slot against the booking rules. An
  -- unassigned attorney can't be validated for office hours — booking requires one, so reject it here.
  if p_reschedule then
    if v_attorney_id is null then
      raise exception 'attorney_required' using errcode = 'check_violation';
    end if;
    perform public.api_validate_booking(p_firm_id, v_attorney_id, v_start_at, v_duration);
  end if;

  -- Status precedence: an explicit terminal status wins; otherwise a reschedule marks the row
  -- 'rescheduled'; otherwise the status is unchanged.
  v_status := coalesce(
    p_status,
    case when p_reschedule then 'rescheduled'::public.consultation_status else v_cur.status end
  );

  update public.consultations c set
    attorney_id   = v_attorney_id,
    start_at      = v_start_at,
    duration_min  = v_duration,
    time_zone     = v_time_zone,
    status        = v_status,
    last_activity = now()
  where c.id = p_id and c.firm_id = p_firm_id;

  return query
    select c.id, c.firm_id, c.lead_id, c.attorney_id, c.type, c.status, c.start_at, c.duration_min,
           c.time_zone, c.paid, c.amount, c.outcome, c.archived, c.created_at, c.last_activity, c.data, false
    from public.consultations c
    where c.id = p_id;
end;
$$;

revoke all on function public.api_update_consultation(
  uuid, uuid, uuid, timestamptz, int, text, public.consultation_status, boolean
) from public;
grant execute on function public.api_update_consultation(
  uuid, uuid, uuid, timestamptz, int, text, public.consultation_status, boolean
) to service_role;
