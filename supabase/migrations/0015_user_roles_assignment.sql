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
declare
  v_firm_id uuid;
  v_primary_key text;
  v_primary_role_id uuid;
  v_ids uuid[];
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- The target's firm + primary role, RLS-scoped to the caller's firm. FOR UPDATE
  -- locks the profile row so a concurrent primary-role change (updateUserProfile via
  -- Manage) can't interleave between this read and the re-insert and leave user_roles
  -- out of sync with profiles.role. firm_id is inserted explicitly (not the column
  -- default) so the composite FKs key off the user's actual firm.
  select firm_id, role::text into v_firm_id, v_primary_key
  from public.profiles
  where id = p_user_id
  for update;
  if v_firm_id is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  -- Always keep the primary role's system role — enforced here (DB), not by the
  -- caller, so a client bug/bypass can't strip a user of their base role.
  select id into v_primary_role_id
  from public.roles
  where firm_id = v_firm_id and key = v_primary_key and is_system;
  -- Fail closed: if the primary system role can't be resolved, don't replace the
  -- set at all (silently dropping the base role would be worse). Seeded firms
  -- always have it, so this only fires on a real inconsistency.
  if v_primary_role_id is null then
    raise exception 'primary system role not found for this user' using errcode = 'P0002';
  end if;

  -- Drop any NULL ids defensively (only reachable via a malformed direct RPC call;
  -- the app never sends them) so the membership test and the insert stay NULL-safe.
  v_ids := array_remove(coalesce(p_role_ids, array[]::uuid[]), null);
  if not (v_primary_role_id = any (v_ids)) then
    v_ids := array_append(v_ids, v_primary_role_id);
  end if;

  delete from public.user_roles where user_id = p_user_id;
  if array_length(v_ids, 1) is not null then
    insert into public.user_roles (user_id, role_id, firm_id)
    select p_user_id, unnest(v_ids), v_firm_id
    on conflict (user_id, role_id) do nothing;
  end if;
end;
$$;
