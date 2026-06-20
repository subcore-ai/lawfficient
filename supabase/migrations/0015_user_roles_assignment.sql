-- Phase 2b (multi-role assignment, spec 25 FR-rbac-4): let admins assign one-or-more
-- roles per user via /settings/users, while profiles.role stays the (transitional)
-- "primary" role that still drives the last-admin guard + the RLS legacy fallback.

-- 1) Make the profiles.role -> user_roles sync ADDITIVE. The 0009 version removed
-- ALL other system roles whenever the primary changed, which would wipe additional
-- roles an admin assigned. Now it only swaps the *previous primary's* system role
-- for the new one and leaves every other assignment (extra system + custom) intact.
create or replace function public.sync_user_role_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_role_id uuid;
  v_old_role_id uuid;
begin
  select id into v_new_role_id
  from public.roles
  where firm_id = new.firm_id and key = new.role::text and is_system;

  -- On a primary-role change, drop only the previous primary's system role.
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    select id into v_old_role_id
    from public.roles
    where firm_id = new.firm_id and key = old.role::text and is_system;
    if v_old_role_id is not null then
      delete from public.user_roles where user_id = new.id and role_id = v_old_role_id;
    end if;
  end if;

  if v_new_role_id is not null then
    insert into public.user_roles (user_id, role_id, firm_id)
    values (new.id, v_new_role_id, new.firm_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

-- 2) Atomic "set a user's roles" (replace). A function body is one transaction, so
-- the delete + insert can't leave a half-assigned set; an advisory lock serializes
-- concurrent edits of the same user. SECURITY INVOKER — the user_roles RLS
-- (firm-scoped, settings.manage / admin) is the gate. firm_id defaults to
-- current_firm_id(); the composite FKs reject any user or role outside the firm.
create or replace function public.set_user_roles(p_user_id uuid, p_role_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  delete from public.user_roles where user_id = p_user_id;
  if array_length(p_role_ids, 1) is not null then
    insert into public.user_roles (user_id, role_id)
    select p_user_id, unnest(p_role_ids)
    on conflict (user_id, role_id) do nothing;
  end if;
end;
$$;
