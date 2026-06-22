-- Gate firm_taxonomy_in_use on settings.manage. It's SECURITY DEFINER (bypasses leads RLS) and
-- granted to authenticated, so without this any firm member could directly call it to probe whether
-- a given label is used by leads in their firm. The delete-guard path is unaffected — deleting a
-- taxonomy already requires settings.manage (firm_taxonomies write RLS), so the caller passes this.
create or replace function public.firm_taxonomy_in_use(p_firm uuid, p_category text, p_label text)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  data_key text;
begin
  if not public.authorize('settings.manage') then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;
  if p_firm is distinct from public.current_firm_id() then
    return false;
  end if;
  data_key := case p_category
    when 'case_type' then 'caseType'
    when 'case_hierarchy' then 'hierarchy'
    when 'qualification' then 'qualification'
  end;
  return exists (
    select 1 from public.leads where firm_id = p_firm and data ->> data_key = p_label
  );
end;
$$;
