-- Reconcile the lead-status guard across environments. An earlier 0019 created
-- public.lead_status_in_use(uuid) (SECURITY DEFINER, revoked from authenticated) and a guard
-- that CALLED it — which breaks status deletes for authenticated users (they lack EXECUTE).
-- 0019 was later edited to inline the in-use check, but editing an already-applied migration
-- doesn't re-run on a migrated database (e.g. remote), so that fix never reached it. This
-- migration brings every environment to the final state: an inlined, firm-scoped in-use check
-- (uses the (firm_id, status_id) index; the composite FK on delete restrict is the hard
-- backstop) and no helper function.
--
-- Idempotent: on a fresh install 0019 already creates this exact guard and the helper never
-- existed, so the create-or-replace is a no-op and the drop is guarded by IF EXISTS.

create or replace function public.guard_lead_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_system and current_user in ('authenticated', 'anon') then
      raise exception 'system lead statuses can only be created by the system seed';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Allow the firm-teardown cascade (parent firm already gone).
    if not public.firm_exists(old.firm_id) then
      return old;
    end if;
    if old.is_system then
      raise exception 'system lead statuses cannot be deleted';
    end if;
    -- Inlined, firm-scoped (uses the composite index). INVOKER — the FK is the hard backstop.
    if exists (
      select 1 from public.leads where status_id = old.id and firm_id = old.firm_id
    ) then
      raise exception 'cannot delete a lead status that still has leads';
    end if;
    return old;
  end if;
  if not old.is_system and new.is_system then
    raise exception 'cannot promote a custom lead status to a system status';
  end if;
  if old.is_system and (
    new.is_system is distinct from old.is_system
    or new.key is distinct from old.key
    or new.firm_id is distinct from old.firm_id
  ) then
    raise exception 'cannot change key, is_system, or firm of a system lead status';
  end if;
  return new;
end;
$$;

drop function if exists public.lead_status_in_use(uuid);
