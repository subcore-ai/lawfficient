-- Re-express the last-admin guard against RBAC (spec 25, FR-rbac-8): a firm must
-- always retain >= 1 active user holding a role that grants settings.manage (the
-- admin-equivalent), replacing the role='admin' check in 0006.
--
-- Coverage. A firm can lose its last settings.manager three ways, so all three are
-- guarded: (1) the holder is deleted / disabled / demoted (profiles), (2) the role
-- that grants settings.manage is un-assigned from the last holder (user_roles),
-- (3) settings.manage is removed from the last granting role (role_permissions, e.g.
-- via the /settings/roles editor).
--
-- The triggers are DEFERRABLE INITIALLY DEFERRED so the invariant is checked at
-- commit — after the profiles.role -> user_roles sync trigger and after a
-- setRolePermissions delete+reinsert, i.e. against the FINAL state. firm_exists()
-- skips the check during firm teardown (the firm row is already gone at commit),
-- and a per-firm advisory lock stops two concurrent removals from both seeing a
-- survivor. Admins are covered automatically: role='admin' -> the admin system role
-- -> settings.manage, so they are settings.managers. Works before the access-token
-- hook is live (it reads the tables, not the JWT).

create or replace function public.firm_has_active_settings_manager(p_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    where p.firm_id = p_firm_id
      and p.status = 'active'
      and rp.permission = 'settings.manage'
  );
$$;

create or replace function public.enforce_settings_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
begin
  -- Resolve the affected firm + skip changes that can't drop settings.manage coverage.
  if tg_table_name = 'role_permissions' then
    if old.permission <> 'settings.manage' then
      return null;
    end if;
    select firm_id into v_firm_id from public.roles where id = old.role_id;
  elsif tg_table_name = 'user_roles' then
    if not exists (
      select 1 from public.role_permissions
      where role_id = old.role_id and permission = 'settings.manage'
    ) then
      return null;
    end if;
    v_firm_id := old.firm_id;
  else
    -- profiles: only a role / status / firm change (or a delete) is relevant.
    if tg_op = 'UPDATE'
       and new.role = old.role
       and new.status = old.status
       and new.firm_id = old.firm_id then
      return null;
    end if;
    v_firm_id := old.firm_id;
  end if;

  -- Nothing to enforce if the firm itself is gone (teardown cascade) or unresolved.
  if v_firm_id is null or not public.firm_exists(v_firm_id) then
    return null;
  end if;

  -- Serialize per firm so concurrent removals can't both observe a survivor.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_firm_id::text, 0));

  if not public.firm_has_active_settings_manager(v_firm_id) then
    raise exception 'a firm must keep at least one active user who can manage settings';
  end if;

  return null;
end;
$$;

-- These run only via their triggers; keep them off the public API surface.
revoke execute on function public.firm_has_active_settings_manager(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_settings_manager() from public, anon, authenticated;

-- Replace the 0006 role='admin' guard.
drop trigger if exists profiles_guard_last_admin on public.profiles;
drop function if exists public.guard_last_admin();

create constraint trigger profiles_keep_settings_manager
  after update or delete on public.profiles
  deferrable initially deferred
  for each row execute function public.enforce_settings_manager();

-- UPDATE too (not just DELETE): re-pointing an assignment's role_id, or changing a
-- role_permissions row's permission off 'settings.manage', also drops coverage. The
-- guard keys off OLD, so it handles both. (INSERT can only add, so it's not guarded.)
create constraint trigger user_roles_keep_settings_manager
  after update or delete on public.user_roles
  deferrable initially deferred
  for each row execute function public.enforce_settings_manager();

create constraint trigger role_permissions_keep_settings_manager
  after update or delete on public.role_permissions
  deferrable initially deferred
  for each row execute function public.enforce_settings_manager();
