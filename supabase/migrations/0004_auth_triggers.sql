-- Provision a profile whenever an auth user is created.
--
-- firm_id, role and name come from app_metadata (raw_app_meta_data), which is
-- only settable with the service role — never from user_metadata, which the
-- user can edit. The invite/bootstrap flow must set app_metadata.firm_id;
-- profiles.firm_id is NOT NULL, so a user created without it will fail loudly
-- rather than land in a firm-less, unscoped state.
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
    coalesce(new.raw_app_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_app_meta_data ->> 'role')::public.staff_role, 'sales'),
    'active'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
