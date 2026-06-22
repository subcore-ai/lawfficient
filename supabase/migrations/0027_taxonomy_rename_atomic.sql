-- (1) Make rename atomic with notes: rename_firm_taxonomy now updates label + notes + the leads
--     bulk-rewrite in one transaction (was a rename RPC followed by a separate notes update).
-- (2) Force ALL custom label changes through that RPC by blocking direct authenticated label updates
--     in the guard — leads.data stores the label string (no FK), so a direct firm_taxonomies label
--     update would leave leads pointing at the old label.

drop function if exists public.rename_firm_taxonomy(uuid, text);

create or replace function public.rename_firm_taxonomy(p_id uuid, p_label text, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old  text;
  v_cat  text;
  v_firm uuid;
  v_key  text;
begin
  if not public.authorize('settings.manage') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  p_label := btrim(p_label);
  if p_label = '' then
    raise exception 'label cannot be empty';
  end if;
  select label, category, firm_id into v_old, v_cat, v_firm
    from public.firm_taxonomies
    where id = p_id and is_system = false;
  if v_old is null then
    raise exception 'taxonomy not found' using errcode = 'P0002';
  end if;
  if v_firm is distinct from public.current_firm_id() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  v_key := case v_cat
    when 'case_type' then 'caseType'
    when 'case_hierarchy' then 'hierarchy'
    when 'qualification' then 'qualification'
  end;
  -- The 0025 CHECK rejects a reserved '__' label here; 23505 on a duplicate.
  update public.firm_taxonomies set label = p_label, notes = p_notes where id = p_id;
  if v_old <> p_label then
    update public.leads
      set data = jsonb_set(data, array[v_key], to_jsonb(p_label)), last_activity = now()
      where firm_id = v_firm and data ->> v_key = v_old;
  end if;
end;
$$;

revoke execute on function public.rename_firm_taxonomy(uuid, text, text) from public;
grant execute on function public.rename_firm_taxonomy(uuid, text, text) to authenticated;

-- Re-define the guard to also block a DIRECT authenticated/anon label change (forcing it through
-- rename_firm_taxonomy, which runs as owner + rewrites leads.data atomically). Everything else
-- matches the 0024 guard (with the 0024-edit in-use helper).
create or replace function public.guard_firm_taxonomy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_system and current_user in ('authenticated', 'anon') then
      raise exception 'system taxonomies can only be created by the system seed';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if not public.firm_exists(old.firm_id) then
      return old;
    end if;
    if old.is_system then
      raise exception 'system taxonomies cannot be deleted';
    end if;
    if public.firm_taxonomy_in_use(old.firm_id, old.category, old.label) then
      raise exception 'cannot delete a taxonomy value still used by leads';
    end if;
    return old;
  end if;
  -- UPDATE
  if not old.is_system and new.is_system then
    raise exception 'cannot promote a custom taxonomy to a system taxonomy';
  end if;
  if old.is_system and (
    new.is_system is distinct from old.is_system
    or new.category is distinct from old.category
    or new.firm_id is distinct from old.firm_id
    or new.label is distinct from old.label
  ) then
    raise exception 'cannot change label, category, is_system, or firm of a system taxonomy';
  end if;
  if new.label is distinct from old.label and current_user in ('authenticated', 'anon') then
    raise exception 'rename via rename_firm_taxonomy() so leads stay in sync';
  end if;
  return new;
end;
$$;
