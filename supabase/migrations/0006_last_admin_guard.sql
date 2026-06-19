-- Guard a firm's last active admin.
--
-- profiles_admin_write (0001) lets any admin in a firm update or delete other
-- users, and the service role bypasses RLS entirely — so a bad action (a UI bug,
-- a stray script, a manual fix) could demote, disable, or delete the only
-- remaining admin and lock the whole firm out of Admin & Settings.
--
-- This trigger makes that impossible at the data layer: if the affected row is
-- the firm's last active admin and the operation would stop it being one (role
-- moved off 'admin', status moved off 'active', or an outright delete), it raises.
-- It fires for the service role too (triggers run regardless of calling role), so
-- it backstops the application-level pre-check rather than relying on it.
--
-- guard_profile_privileges (0001) already stops a user demoting/disabling *their
-- own* admin row; this covers an admin acting on the firm's other admins.
create or replace function public.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_losing_admin boolean;
  v_other_admins int;
begin
  -- Is this operation removing an active admin? (NEW is null on DELETE, so the
  -- two cases are kept separate to avoid touching NEW in a delete.)
  if tg_op = 'DELETE' then
    v_losing_admin := (old.role = 'admin' and old.status = 'active');
  else
    v_losing_admin := (old.role = 'admin' and old.status = 'active'
                       and (new.role <> 'admin' or new.status <> 'active'));
  end if;

  if v_losing_admin then
    select count(*) into v_other_admins
    from public.profiles
    where firm_id = old.firm_id
      and role = 'admin'
      and status = 'active'
      and id <> old.id;

    if v_other_admins = 0 then
      raise exception 'cannot remove the last active admin of a firm';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger profiles_guard_last_admin
  before update or delete on public.profiles
  for each row execute function public.guard_last_admin();
