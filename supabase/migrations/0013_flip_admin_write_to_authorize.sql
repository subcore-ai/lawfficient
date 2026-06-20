-- Phase 2b, step 1 (spec 25, FR-rbac-5/8/10): flip the role-based admin-write RLS
-- policies from the hardcoded current_staff_role()='admin' check to RBAC permissions
-- via authorize(), reading app_metadata.permissions from the JWT.
--
-- TRANSITION-SAFE: each policy keeps a legacy `or current_staff_role()='admin'`
-- fallback, so there is NO lockout if the access-token hook isn't live yet (a JWT
-- without app_metadata.permissions makes authorize() return false). A follow-up
-- drops the fallback once the hook is registered + verified on the remote project.
--
-- Scope: only the 6 role-based policies (all admin-write). Data tables (leads,
-- cases, …) are firm-only and unchanged here — their per-module authorize()
-- enforcement is a separate step. Permission mapping: profiles (user management)
-- -> users.manage; pods / packet_stages (firm config) + roles / role_permissions /
-- user_roles (RBAC) -> settings.manage.

alter policy "profiles_admin_write" on public.profiles
  using (
    firm_id = public.current_firm_id()
    and (public.authorize('users.manage') or public.current_staff_role() = 'admin')
  )
  with check (
    firm_id = public.current_firm_id()
    and (public.authorize('users.manage') or public.current_staff_role() = 'admin')
  );

alter policy "pods_admin_write" on public.pods
  using (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  )
  with check (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  );

alter policy "packet_stages_admin_write" on public.packet_stages
  using (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  )
  with check (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  );

alter policy "roles_admin_write" on public.roles
  using (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  )
  with check (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  );

alter policy "role_permissions_admin_write" on public.role_permissions
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_id and r.firm_id = public.current_firm_id()
    )
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_id and r.firm_id = public.current_firm_id()
    )
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  );

alter policy "user_roles_admin_write" on public.user_roles
  using (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  )
  with check (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or public.current_staff_role() = 'admin')
  );
