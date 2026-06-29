-- Make booking validation ATOMIC with the consultation write.
--
-- The in-app create/reschedule previously called api_validate_booking and THEN inserted/updated as two
-- separate statements — a TOCTOU window where office hours / time-off could change in between, persisting a
-- consult the rule would now reject. A BEFORE INSERT/UPDATE trigger runs the same check inside the write's
-- own transaction, so it cannot drift, for EVERY writer (the in-app actions, the public API, anything
-- future). No-double-book was already atomic via the 0043 exclusion constraint; this extends atomicity to
-- the office-hours / time-off / holiday rule.
--
-- Because enforcement now lives at the table, the in-app path no longer calls api_validate_booking directly,
-- so we REVOKE its `authenticated` grant (added in 0050). That closes the gap where any signed-in user —
-- including one WITHOUT consultations.edit, or without a firm — could call the SECURITY DEFINER function
-- over the Data API and probe a firm's availability. It stays executable by service_role (the public API's
-- early-validation call) and by the trigger, which runs as the function owner.

create or replace function public.consultations_validate_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- An unassigned consult has no attorney to validate against (consistent with the "Unassigned" option).
  -- The trigger's `update of` clause already limits firing to slot-field changes, so a `paid`/`amount`-only
  -- edit never re-runs the check.
  if new.attorney_id is not null then
    perform public.api_validate_booking(new.firm_id, new.attorney_id, new.start_at, new.duration_min);
  end if;
  return new;
end;
$$;

-- A trigger function is only ever fired by the table op, never called directly, so lock down EXECUTE.
revoke all on function public.consultations_validate_booking() from public;

drop trigger if exists consultations_validate_booking on public.consultations;
create trigger consultations_validate_booking
  before insert or update of attorney_id, start_at, duration_min on public.consultations
  for each row execute function public.consultations_validate_booking();

-- See header: api_validate_booking is now reached only via the trigger (as owner) and service_role (the
-- API). A direct `authenticated` call was an availability-probing surface for a user without
-- consultations.edit, so drop that grant.
revoke execute on function public.api_validate_booking(uuid, uuid, timestamptz, int) from authenticated;
