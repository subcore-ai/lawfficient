-- RBAC guard fix (spec 25): make the role guard's firm-teardown check independent
-- of the caller's table grants.
--
-- guard_system_role() (0008) runs SECURITY INVOKER on purpose — its INSERT branch
-- reads current_user to block a client role forging a system role. But its DELETE
-- branch also reads public.firms (to detect a firm cascade and allow it), and the
-- authenticated role isn't granted SELECT on firms. So an admin deleting a *custom*
-- role through the /settings/roles editor hit "permission denied for table firms".
--
-- A SECURITY DEFINER existence helper does just that one lookup with owner
-- privileges, so the guard stays INVOKER. The helper only reveals whether a given
-- firm id exists (a boolean on an unguessable uuid), and EXECUTE is limited to the
-- roles that actually run the guard.
create or replace function public.firm_exists(p_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.firms where id = p_firm_id);
$$;

revoke execute on function public.firm_exists(uuid) from public, anon;
grant execute on function public.firm_exists(uuid) to authenticated, service_role;

-- Replace the guard body: the only change is firm_exists() in place of the inline
-- "select 1 from public.firms" so the firm-cascade check no longer needs the caller
-- to hold SELECT on firms. All other branches are unchanged from 0008.
create or replace function public.guard_system_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- System roles may only be created by the seed, which runs as the table owner
    -- (SECURITY DEFINER). A client role (authenticated/anon) inserting is_system=true
    -- would forge an immutable, undeletable role outside the seeded matrix.
    if new.is_system and current_user in ('authenticated', 'anon') then
      raise exception 'system roles can only be created by the system seed';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Allow the cascade when the firm itself is being deleted (firm teardown):
    -- the parent firm row is already gone, so the guards below would otherwise
    -- wrongly block legitimate cleanup.
    if not public.firm_exists(old.firm_id) then
      return old;
    end if;
    if old.is_system then
      raise exception 'system roles cannot be deleted';
    end if;
    if exists (select 1 from public.user_roles where role_id = old.id) then
      raise exception 'cannot delete a role that still has assigned users';
    end if;
    return old;
  end if;
  -- Block promoting a custom role into a system role (it would become immutable +
  -- undeletable under the guards above despite never being seeded).
  if not old.is_system and new.is_system then
    raise exception 'cannot promote a custom role to a system role';
  end if;
  -- A system role's key/is_system/firm are immutable; renaming + editing its
  -- permissions stays allowed.
  if old.is_system and (
    new.is_system is distinct from old.is_system
    or new.key is distinct from old.key
    or new.firm_id is distinct from old.firm_id
  ) then
    raise exception 'cannot change key, is_system, or firm of a system role';
  end if;
  return new;
end;
$$;
