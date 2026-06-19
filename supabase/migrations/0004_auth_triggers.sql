-- Provision a profile whenever an auth user is created.
--
-- firm_id, role, status and name come from app_metadata (raw_app_meta_data),
-- which is only settable with the service role — never from user_metadata,
-- which the user can edit. The invite/bootstrap flow must set
-- app_metadata.firm_id; profiles.firm_id is NOT NULL, so a user created without
-- it will fail loudly rather than land in a firm-less, unscoped state.
-- status defaults to 'active' (bootstrap + direct signup); an invite flow that
-- should gate access until acceptance passes app_metadata.status = 'invited'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, firm_id, name, email, role, status)
  values (
    new.id,
    (new.raw_app_meta_data ->> 'firm_id')::uuid,
    coalesce(new.raw_app_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'Staff User'),
    coalesce(new.email, ''),
    coalesce((new.raw_app_meta_data ->> 'role')::public.staff_role, 'sales'),
    coalesce((new.raw_app_meta_data ->> 'status')::public.staff_status, 'active')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
