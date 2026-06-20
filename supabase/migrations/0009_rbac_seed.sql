-- RBAC seed (spec 25, migration step 1–3): seed the 9 system roles per firm with
-- the spec-02 permission matrix, backfill user_roles from each profiles.role, and
-- install a trigger so NEW firms auto-seed the same system roles. Custom roles
-- (is_system = false) are created by admins on top of this baseline.

-- Reusable: seed the system roles + their permissions for one firm. SECURITY
-- DEFINER so it runs at firm-creation time (before any admin exists for the firm)
-- and from the migration; it only ever writes system rows for the given firm.
create or replace function public.seed_system_roles(p_firm_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.roles (firm_id, key, name, is_system)
  values
    (p_firm_id, 'admin',               'Admin',                true),
    (p_firm_id, 'attorney',            'Attorney',             true),
    (p_firm_id, 'la_lead',             'LA Team Lead',         true),
    (p_firm_id, 'legal_assistant',     'Legal Assistant',      true),
    (p_firm_id, 'qa_lead',             'QA Team Lead',         true),
    (p_firm_id, 'creative_writer',     'Creative Writer',      true),
    (p_firm_id, 'sales',               'Sales & Client Care',  true),
    (p_firm_id, 'accounts_receivable', 'Accounts Receivable',  true),
    (p_firm_id, 'file_clerk',          'File Clerk',           true)
  on conflict (firm_id, key) do nothing;

  insert into public.role_permissions (role_id, permission)
  select ro.id, m.permission::public.app_permission
  from public.roles ro
  join (values
    -- Dashboard: everyone.
    ('admin','dashboard.view'),('attorney','dashboard.view'),('la_lead','dashboard.view'),
    ('legal_assistant','dashboard.view'),('qa_lead','dashboard.view'),('creative_writer','dashboard.view'),
    ('sales','dashboard.view'),('accounts_receivable','dashboard.view'),('file_clerk','dashboard.view'),
    -- Admin: full.
    ('admin','leads.view'),('admin','leads.edit'),('admin','consultations.view'),('admin','consultations.edit'),
    ('admin','clients.view'),('admin','clients.edit'),('admin','cases.view'),('admin','cases.edit'),
    ('admin','documents.view'),('admin','documents.edit'),('admin','billing.view'),('admin','billing.edit'),
    ('admin','reporting.view'),('admin','reporting.edit'),('admin','users.manage'),('admin','settings.manage'),
    -- Attorney.
    ('attorney','leads.view'),('attorney','consultations.view'),('attorney','consultations.edit'),
    ('attorney','clients.view'),('attorney','clients.edit'),('attorney','cases.view'),('attorney','cases.edit'),
    ('attorney','documents.view'),('attorney','documents.edit'),('attorney','billing.view'),('attorney','reporting.view'),
    -- LA Team Lead.
    ('la_lead','leads.view'),('la_lead','consultations.view'),('la_lead','clients.view'),('la_lead','clients.edit'),
    ('la_lead','cases.view'),('la_lead','cases.edit'),('la_lead','documents.view'),('la_lead','documents.edit'),
    ('la_lead','reporting.view'),
    -- Legal Assistant.
    ('legal_assistant','leads.view'),('legal_assistant','consultations.view'),('legal_assistant','clients.view'),
    ('legal_assistant','clients.edit'),('legal_assistant','cases.view'),('legal_assistant','cases.edit'),
    ('legal_assistant','documents.view'),('legal_assistant','documents.edit'),('legal_assistant','reporting.view'),
    -- QA Team Lead.
    ('qa_lead','cases.view'),('qa_lead','cases.edit'),('qa_lead','documents.view'),('qa_lead','documents.edit'),
    ('qa_lead','reporting.view'),
    -- Creative Writer.
    ('creative_writer','cases.view'),('creative_writer','cases.edit'),
    ('creative_writer','documents.view'),('creative_writer','documents.edit'),
    -- Sales & Client Care.
    ('sales','leads.view'),('sales','leads.edit'),('sales','consultations.view'),('sales','consultations.edit'),
    ('sales','clients.view'),('sales','billing.view'),('sales','reporting.view'),
    -- Accounts Receivable.
    ('accounts_receivable','leads.view'),('accounts_receivable','leads.edit'),
    ('accounts_receivable','consultations.view'),('accounts_receivable','consultations.edit'),
    ('accounts_receivable','clients.view'),('accounts_receivable','clients.edit'),
    ('accounts_receivable','billing.view'),('accounts_receivable','billing.edit'),
    ('accounts_receivable','reporting.view'),('accounts_receivable','reporting.edit'),
    -- File Clerk (billing is status-only, never amounts).
    ('file_clerk','cases.view'),('file_clerk','documents.view'),('file_clerk','documents.edit'),
    ('file_clerk','billing.view_status')
  ) as m(key, permission) on m.key = ro.key
  where ro.firm_id = p_firm_id and ro.is_system
  on conflict (role_id, permission) do nothing;
end;
$$;

-- Seed every existing firm.
select public.seed_system_roles(id) from public.firms;

-- Backfill: give each user the system role matching their current profiles.role.
insert into public.user_roles (user_id, role_id, firm_id)
select p.id, ro.id, p.firm_id
from public.profiles p
join public.roles ro
  on ro.firm_id = p.firm_id and ro.key = p.role::text and ro.is_system
on conflict (user_id, role_id) do nothing;

-- New firms get the system roles automatically.
create or replace function public.seed_system_roles_on_firm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_system_roles(new.id);
  return new;
end;
$$;

create trigger firms_seed_system_roles
  after insert on public.firms
  for each row execute function public.seed_system_roles_on_firm();

-- Transitional sync: while profiles.role stays authoritative (Phase 1), mirror it
-- into user_roles so every user (existing, seeded, or newly invited) holds the
-- matching system role — and thus gets permissions in their JWT. Custom-role
-- assignments are left untouched. A follow-up makes user_roles authoritative and
-- drops this trigger.
create or replace function public.sync_user_role_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_id uuid;
begin
  select id into v_role_id
  from public.roles
  where firm_id = new.firm_id and key = new.role::text and is_system;

  if v_role_id is not null then
    -- Drop any *previous* system role (role changed); keep custom roles.
    delete from public.user_roles ur
    using public.roles r
    where ur.user_id = new.id
      and ur.role_id = r.id
      and r.is_system
      and ur.role_id <> v_role_id;

    insert into public.user_roles (user_id, role_id, firm_id)
    values (new.id, v_role_id, new.firm_id)
    on conflict (user_id, role_id) do nothing;
  end if;
  return new;
end;
$$;

-- Watches role only: a firm move is structurally blocked by the user_roles
-- composite FK (cannot change profiles.firm_id while assignments reference the
-- old firm), so there's no stale-assignment case to handle here.
create trigger profiles_sync_user_role
  after insert or update of role on public.profiles
  for each row execute function public.sync_user_role_from_profile();

-- Least privilege: these SECURITY DEFINER functions bypass RLS and must not be
-- callable by clients — only the migration (as postgres) and the firm/profile
-- triggers invoke them. Revoking EXECUTE does not stop the triggers from firing.
revoke execute on function public.seed_system_roles(uuid) from public, anon, authenticated;
revoke execute on function public.seed_system_roles_on_firm() from public, anon, authenticated;
revoke execute on function public.sync_user_role_from_profile() from public, anon, authenticated;
