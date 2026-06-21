-- Phase 2b, final: retire the RBAC transition fallbacks now that the access-token
-- hook is live + verified on remote (it stamps app_metadata.permissions into the JWT).
-- Authorization becomes 100% permission-based: every policy that carried a legacy
-- fallback now relies solely on authorize(), and the two fallback helpers are dropped.
--
-- profiles.role stays as the primary-role label only — nothing in AUTHZ reads it now:
-- the last-admin guard (0016) keys off settings.manage, the RLS policies key off the
-- JWT permission claim, and the app gates on the same claim.

-- 1) Admin-write policies: drop the `or public.current_staff_role()='admin'` fallback (0013).
alter policy "profiles_admin_write" on public.profiles
  using (firm_id = public.current_firm_id() and public.authorize('users.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('users.manage'));

alter policy "pods_admin_write" on public.pods
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

alter policy "packet_stages_admin_write" on public.packet_stages
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

alter policy "roles_admin_write" on public.roles
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

alter policy "role_permissions_admin_write" on public.role_permissions
  using (
    exists (select 1 from public.roles r where r.id = role_id and r.firm_id = public.current_firm_id())
    and public.authorize('settings.manage')
  )
  with check (
    exists (select 1 from public.roles r where r.id = role_id and r.firm_id = public.current_firm_id())
    and public.authorize('settings.manage')
  );

alter policy "user_roles_admin_write" on public.user_roles
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

-- 2) Data tables: drop the `or public.rbac_unstamped()` fallback (0014). reads->view, writes->edit.
do $$
declare
  r record;
begin
  for r in (
    select * from (values
      ('leads',             'leads.view',         'leads.edit'),
      ('interactions',      'leads.view',         'leads.edit'),
      ('consultations',     'consultations.view', 'consultations.edit'),
      ('clients',           'clients.view',       'clients.edit'),
      ('immigration_cases', 'cases.view',         'cases.edit'),
      ('deadlines',         'cases.view',         'cases.edit'),
      ('case_tasks',        'cases.view',         'cases.edit'),
      ('documents',         'documents.view',     'documents.edit')
    ) as v(tbl, view_perm, edit_perm)
  )
  loop
    execute format($f$
      alter policy "%1$s_select" on public.%1$I
        using (firm_id = public.current_firm_id() and public.authorize(%2$L));
    $f$, r.tbl, r.view_perm);

    execute format($f$
      alter policy "%1$s_insert" on public.%1$I
        with check (firm_id = public.current_firm_id() and public.authorize(%2$L));
    $f$, r.tbl, r.edit_perm);

    execute format($f$
      alter policy "%1$s_update" on public.%1$I
        using (firm_id = public.current_firm_id() and public.authorize(%2$L))
        with check (firm_id = public.current_firm_id() and public.authorize(%2$L));
    $f$, r.tbl, r.edit_perm);

    execute format($f$
      alter policy "%1$s_delete" on public.%1$I
        using (firm_id = public.current_firm_id() and public.authorize(%2$L));
    $f$, r.tbl, r.edit_perm);
  end loop;
end $$;

-- Invoices: read billing.view OR billing.view_status; write billing.edit.
alter policy "invoices_select" on public.invoices
  using (firm_id = public.current_firm_id()
         and (public.authorize('billing.view') or public.authorize('billing.view_status')));
alter policy "invoices_insert" on public.invoices
  with check (firm_id = public.current_firm_id() and public.authorize('billing.edit'));
alter policy "invoices_update" on public.invoices
  using (firm_id = public.current_firm_id() and public.authorize('billing.edit'))
  with check (firm_id = public.current_firm_id() and public.authorize('billing.edit'));
alter policy "invoices_delete" on public.invoices
  using (firm_id = public.current_firm_id() and public.authorize('billing.edit'));

-- Audit log read: reporting.view.
alter policy "audit_log_select" on public.audit_log
  using (firm_id = public.current_firm_id() and public.authorize('reporting.view'));

-- 3) invite_token_for (0007) still gated on current_staff_role() in its body — move it
--    to the permission so the helper can be dropped. SECURITY DEFINER, but authorize()
--    reads the CALLER's JWT; current_firm_id() still constrains to active staff.
create or replace function public.invite_token_for(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid;
  v_token text;
begin
  -- Caller must hold users.manage (was: current_staff_role() = 'admin').
  if not public.authorize('users.manage') then
    return null;
  end if;
  v_firm := public.current_firm_id();
  if v_firm is null then
    return null;
  end if;

  select u.confirmation_token
    into v_token
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id
    and p.firm_id = v_firm
    and p.status = 'invited';

  return nullif(v_token, '');
end;
$$;

-- 4) Drop the now-unreferenced transition helpers.
drop function if exists public.current_staff_role();
drop function if exists public.rbac_unstamped();
