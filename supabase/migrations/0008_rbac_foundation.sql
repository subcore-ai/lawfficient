-- RBAC foundation (spec 25): data-driven roles + permissions, enforced via a
-- custom access-token hook that stamps the user's effective permissions into the
-- JWT, read by authorize() in RLS.
--
-- PHASE 1 is ADDITIVE: it stands up the tables, hook, and authorize() and seeds
-- them (see 0009), but does NOT rewrite the existing profiles.role + can() / RLS
-- enforcement. The new RBAC tables are admin-managed via the existing
-- current_staff_role()='admin' check so they work before the hook is registered;
-- a follow-up flips all enforcement to authorize() and retires profiles.role.
--
-- The hook + authorize() SQL follows Supabase's "Custom Claims & RBAC" guide,
-- adapted for MULTIPLE roles per user: the hook stamps the UNION of permissions
-- (an array) into app_metadata.permissions, and authorize() tests membership.

-- ---------------------------------------------------------------- Vocabulary
-- Controlled permission vocabulary (module.action). New permissions are added by
-- migration only, never by users (FR-rbac-2). Mirrors the spec-02 module matrix.
create type public.app_permission as enum (
  'dashboard.view',
  'leads.view',         'leads.edit',
  'consultations.view', 'consultations.edit',
  'clients.view',       'clients.edit',
  'cases.view',         'cases.edit',
  'documents.view',     'documents.edit',
  'billing.view',       'billing.view_status', 'billing.edit',
  'reporting.view',     'reporting.edit',
  'users.manage',
  'settings.manage'
);

-- ---------------------------------------------------------------- Tables

-- A role is a row, scoped to a firm. The 9 seeded staff roles are is_system and
-- cannot be deleted; admins add custom roles per firm (FR-rbac-1).
create table public.roles (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null default public.current_firm_id() references public.firms(id) on delete cascade,
  key        text not null,           -- stable slug, e.g. 'admin'
  name       text not null,           -- display label
  is_system  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (firm_id, key),
  -- Lets user_roles reference (role_id, firm_id) so an assignment's role is
  -- provably in the row's firm (tenant isolation).
  unique (id, firm_id)
);
create index roles_firm_id_idx on public.roles (firm_id);

-- role → permission grants — the admin-editable matrix (FR-rbac-3).
create table public.role_permissions (
  role_id    uuid not null references public.roles(id) on delete cascade,
  permission public.app_permission not null,
  primary key (role_id, permission)
);

-- profiles.id is already unique (PK); the explicit (id, firm_id) unique lets
-- user_roles reference BOTH columns for tenant isolation.
alter table public.profiles add constraint profiles_id_firm_id_key unique (id, firm_id);

-- user → role assignments; a user may hold MULTIPLE roles (FR-rbac-4). The
-- composite FKs guarantee the role AND the user belong to the row's firm, so an
-- admin can't assign another firm's role or user (firm_id is also the RLS scope).
create table public.user_roles (
  user_id uuid not null,
  role_id uuid not null,
  firm_id uuid not null default public.current_firm_id() references public.firms(id) on delete cascade,
  primary key (user_id, role_id),
  foreign key (user_id, firm_id) references public.profiles(id, firm_id) on delete cascade,
  foreign key (role_id, firm_id) references public.roles(id, firm_id) on delete cascade
);
create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_firm_id_idx on public.user_roles (firm_id);

-- ---------------------------------------------------------------- authorize()
-- True when the caller's JWT carries `permission` in app_metadata.permissions
-- (stamped by the access-token hook below). Reads the JWT only — no table joins
-- per row (FR-rbac-5). SECURITY INVOKER: it only inspects the request's own JWT.
create or replace function public.authorize(requested_permission public.app_permission)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' -> 'permissions') ? (requested_permission::text),
    false
  );
$$;

-- ---------------------------------------------------------------- Access-token hook
-- Stamps the UNION of the user's role permissions into app_metadata.permissions.
-- SECURITY DEFINER (runs as owner, bypassing RLS) + search_path='' per spec 25 and
-- Supabase's hook guidance; EXECUTE granted only to supabase_auth_admin. Registered
-- in config.toml + the dashboard.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  perms  jsonb;
begin
  select coalesce(jsonb_agg(distinct rp.permission::text), '[]'::jsonb)
    into perms
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  where ur.user_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';
  if jsonb_typeof(claims -> 'app_metadata') = 'object' then
    claims := jsonb_set(claims, '{app_metadata,permissions}', perms);
  else
    claims := jsonb_set(claims, '{app_metadata}', jsonb_build_object('permissions', perms));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- ---------------------------------------------------------------- Hook grants
-- GoTrue invokes the hook as supabase_auth_admin; lock it away from clients.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- ---------------------------------------------------------------- RLS
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- Firm-scoped read for any authenticated staff; writes by admins. Phase 1 keeps
-- the existing current_staff_role()='admin' check (works before the hook is live);
-- a follow-up switches writes to authorize('settings.manage').
create policy "roles_select_firm" on public.roles
  for select to authenticated
  using (firm_id = public.current_firm_id());
create policy "roles_admin_write" on public.roles
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin')
  with check (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin');

create policy "role_permissions_select_firm" on public.role_permissions
  for select to authenticated
  using (exists (
    select 1 from public.roles r
    where r.id = role_id and r.firm_id = public.current_firm_id()
  ));
create policy "role_permissions_admin_write" on public.role_permissions
  for all to authenticated
  using (exists (
    select 1 from public.roles r
    where r.id = role_id and r.firm_id = public.current_firm_id()
      and public.current_staff_role() = 'admin'
  ))
  with check (exists (
    select 1 from public.roles r
    where r.id = role_id and r.firm_id = public.current_firm_id()
      and public.current_staff_role() = 'admin'
  ));

create policy "user_roles_select_firm" on public.user_roles
  for select to authenticated
  using (firm_id = public.current_firm_id());
create policy "user_roles_admin_write" on public.user_roles
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin')
  with check (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin');

-- ---------------------------------------------------------------- Role guard
-- System roles can't be deleted and their key/is_system/firm are immutable; and a
-- role (system OR custom) with assigned users can't be deleted (FR-rbac-1 + the
-- spec acceptance criteria) — assignments must be removed first, rather than being
-- silently cascaded away. Renaming + editing permissions stays allowed.
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
    if not exists (select 1 from public.firms where id = old.firm_id) then
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

create trigger roles_guard_system
  before insert or update or delete on public.roles
  for each row execute function public.guard_system_role();
