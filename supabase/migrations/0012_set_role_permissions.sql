-- Atomic role-permission replace (spec 25, FR-rbac-3). The /settings/roles matrix
-- saves a role's whole permission set at once. Doing that as a client-side
-- delete-then-insert isn't atomic: if the re-insert fails after the delete commits,
-- the role is left with ZERO permissions. A function body runs in a single
-- transaction, so the delete + insert here commit or roll back together.
--
-- SECURITY INVOKER: it runs as the caller, so the existing role_permissions RLS
-- (firm-scoped, admin-only write) is the gate — no extra authorization here.
create or replace function public.set_role_permissions(
  p_role_id uuid,
  p_permissions public.app_permission[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serialize concurrent saves for the same role so a replace stays last-write-wins:
  -- without this, two saves on a role that currently has no rows can both insert and
  -- merge into A ∪ B instead of replacing. Keyed on the role id (txn-scoped lock).
  perform pg_advisory_xact_lock(hashtext(p_role_id::text));

  -- Fail fast if the role is gone or outside the caller's firm (RLS-scoped read), so
  -- an empty-permission save can't report false success on a missing role.
  if not exists (select 1 from public.roles where id = p_role_id) then
    raise exception 'role not found' using errcode = 'P0002';
  end if;

  delete from public.role_permissions where role_id = p_role_id;
  if array_length(p_permissions, 1) is not null then
    insert into public.role_permissions (role_id, permission)
    select p_role_id, unnest(p_permissions)
    on conflict do nothing;
  end if;
end;
$$;
