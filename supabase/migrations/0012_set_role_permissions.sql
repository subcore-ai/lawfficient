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
  delete from public.role_permissions where role_id = p_role_id;
  if array_length(p_permissions, 1) is not null then
    insert into public.role_permissions (role_id, permission)
    select p_role_id, unnest(p_permissions)
    on conflict do nothing;
  end if;
end;
$$;
