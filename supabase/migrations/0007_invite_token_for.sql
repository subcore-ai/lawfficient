-- Let an admin copy/share a pending invite's activation link directly (not only
-- via email). The invite token lives in auth.users.confirmation_token (GoTrue),
-- which the Data API doesn't expose — so this SECURITY DEFINER function reaches
-- it, but only for an *active admin* reading an *invited* user in *their own
-- firm*. The app turns the returned token_hash into
-- /auth/confirm?token_hash=…&type=invite.
--
-- We read the existing token rather than generateLink(), which *regenerates* it
-- and would silently invalidate the link already emailed to the user.
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
  -- Caller must be an active admin (current_* resolve only for active staff).
  if public.current_staff_role() is distinct from 'admin' then
    return null;
  end if;
  v_firm := public.current_firm_id();
  if v_firm is null then
    return null;
  end if;

  -- Target must be an invited user in the caller's firm.
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

-- SECURITY DEFINER functions in public are EXECUTE-able by PUBLIC by default;
-- lock to authenticated (the body still enforces admin + firm).
revoke execute on function public.invite_token_for(uuid) from public, anon;
grant execute on function public.invite_token_for(uuid) to authenticated;
