-- Atomic single-key qualification update (review feedback on #27). jsonb_set touches only
-- data->qualification (and the clear path removes only that key), so a concurrent update to another
-- data key can't be lost — unlike a read-merge-write of the whole blob. SECURITY INVOKER, so the
-- UPDATE still respects the leads RLS (firm + leads.edit); the value is validated against the firm's
-- qualification taxonomy (active OR inactive) here so the inline control's deactivated option works.
-- Returns the updated lead id (NULL when no row matched — wrong id or RLS) so the caller can tell a
-- real change from a no-op and not log a phantom timeline event.
create or replace function public.set_lead_qualification(p_id uuid, p_value text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_value <> '' and not exists (
    select 1 from public.firm_taxonomies
    where firm_id = public.current_firm_id()
      and category = 'qualification'
      and label = p_value
  ) then
    raise exception 'qualification not available';
  end if;

  update public.leads
    set data = case
                 when p_value = '' then data - 'qualification'
                 else jsonb_set(coalesce(data, '{}'::jsonb), '{qualification}', to_jsonb(p_value))
               end,
        last_activity = now()
    where id = p_id
    returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.set_lead_qualification(uuid, text) from public;
grant execute on function public.set_lead_qualification(uuid, text) to authenticated;
