-- Make profile provisioning resilient to *when* app_metadata is set.
--
-- 0004 assumed app_metadata (firm_id/role/name) is already present on the INSERT
-- into auth.users. The hosted GoTrue admin "create user" flow applies
-- app_metadata in a follow-up UPDATE, so at INSERT time raw_app_meta_data has no
-- firm_id; profiles.firm_id is NOT NULL, so the insert aborts and the whole
-- createUser call fails with HTTP 500.
--
-- Fix: provision the profile when firm_id is actually available — on insert if
-- it's already there, otherwise on the update that sets it — and upsert so it's
-- idempotent. firm_id/role are still read ONLY from app_metadata (service-role
-- only), never user_metadata, so a user can't self-assign a firm or role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := (new.raw_app_meta_data ->> 'firm_id')::uuid;
begin
  if v_firm is null then
    -- app_metadata not set yet; the UPDATE that sets it will re-fire this trigger.
    return new;
  end if;

  insert into public.profiles (id, firm_id, name, email, role, status)
  values (
    new.id,
    v_firm,
    coalesce(new.raw_app_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'Staff User'),
    coalesce(new.email, ''),
    coalesce((new.raw_app_meta_data ->> 'role')::public.staff_role, 'sales'),
    coalesce((new.raw_app_meta_data ->> 'status')::public.staff_status, 'active')
  )
  on conflict (id) do update set
    firm_id = excluded.firm_id,
    name    = excluded.name,
    email   = excluded.email,
    role    = excluded.role,
    status  = excluded.status;

  return new;
end;
$$;

-- Fire on insert and on the app_metadata update (not on every last_sign_in_at touch).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.handle_new_user();
