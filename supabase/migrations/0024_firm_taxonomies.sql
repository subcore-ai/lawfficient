-- Generic firm-defined taxonomy lookup (case types, case hierarchy, qualification; extensible).
-- Replaces the hard-coded CASE_TYPES / HIERARCHIES / QUALIFICATIONS enums so firms with different
-- areas of practice define their own vocabularies. Modeled on 0018 (lead_statuses): per-firm
-- seeded rows, a firm-read / settings.manage-write RLS split, and a guard trigger protecting
-- seeded rows. leads.data stores the label string (no FK), so the guard's in-use check is an
-- inlined jsonb scan and renames bulk-update leads.data via rename_firm_taxonomy().

-- Append the audit entity (own statement, before use; same idiom as 0010/0021).
alter type public.audit_entity add value if not exists 'taxonomy';

create table public.firm_taxonomies (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.current_firm_id() references public.firms(id) on delete cascade,
  category text not null check (category in ('case_type', 'case_hierarchy', 'qualification')),
  label text not null check (label = btrim(label) and length(label) > 0),
  notes text,
  position int not null default 0,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (firm_id, category, label)
);

create index firm_taxonomies_firm_category_idx
  on public.firm_taxonomies (firm_id, category, position);

-- Seed today's hard-coded vocabularies for one firm. SECURITY DEFINER: runs from the migration +
-- the new-firm trigger, only ever writing system rows for the given firm. NOTE: qualification rows
-- store the legacy KEYS (pending/qualified/not_qualified), because leads.data.qualification already
-- stores those keys and qualificationBadge maps them — storing display labels would invalidate
-- existing data.
create or replace function public.seed_firm_taxonomies(p_firm_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.firm_taxonomies (firm_id, category, label, position, is_system)
  values
    (p_firm_id, 'case_type', 'VAWA (Abeyance)',       0, true),
    (p_firm_id, 'case_type', 'VAWA (AOS)',            1, true),
    (p_firm_id, 'case_type', 'Marriage-Based GC',     2, true),
    (p_firm_id, 'case_type', 'N-400 Naturalization',  3, true),
    (p_firm_id, 'case_type', 'Family-Based Petition', 4, true),
    (p_firm_id, 'case_type', 'NVC Case',              5, true),
    (p_firm_id, 'case_type', 'Removal of Conditions', 6, true),
    (p_firm_id, 'case_hierarchy', 'HRC',  0, true),
    (p_firm_id, 'case_hierarchy', 'NHRC', 1, true),
    (p_firm_id, 'qualification', 'pending',       0, true),
    (p_firm_id, 'qualification', 'qualified',     1, true),
    (p_firm_id, 'qualification', 'not_qualified', 2, true)
  on conflict (firm_id, category, label) do nothing;
end;
$$;

-- Seed every existing firm.
select public.seed_firm_taxonomies(id) from public.firms;

-- New firms auto-seed (sibling to firms_seed_lead_statuses).
create or replace function public.seed_firm_taxonomies_on_firm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_firm_taxonomies(new.id);
  return new;
end;
$$;

create trigger firms_seed_firm_taxonomies
  after insert on public.firms
  for each row execute function public.seed_firm_taxonomies_on_firm();

-- Least privilege: only the migration + trigger call the seeds.
revoke execute on function public.seed_firm_taxonomies(uuid) from public, anon, authenticated;
revoke execute on function public.seed_firm_taxonomies_on_firm() from public, anon, authenticated;

-- Guard: protect seeded rows; block deleting a value still used by leads. The in-use check is an
-- inlined, firm-scoped jsonb scan (no FK exists — leads.data stores the label). It runs as the
-- caller (INVOKER), so under leads RLS it's a best-effort backstop; the delete action does the
-- authoritative check via the service-role client, and deactivate is the recommended retire path.
-- `notes` stays editable on system rows (it's annotation, not identity).
create or replace function public.guard_firm_taxonomy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  data_key text;
begin
  if tg_op = 'INSERT' then
    if new.is_system and current_user in ('authenticated', 'anon') then
      raise exception 'system taxonomies can only be created by the system seed';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Allow the firm-teardown cascade (parent firm already gone).
    if not public.firm_exists(old.firm_id) then
      return old;
    end if;
    if old.is_system then
      raise exception 'system taxonomies cannot be deleted';
    end if;
    data_key := case old.category
      when 'case_type' then 'caseType'
      when 'case_hierarchy' then 'hierarchy'
      when 'qualification' then 'qualification'
    end;
    if exists (
      select 1 from public.leads
      where firm_id = old.firm_id and data ->> data_key = old.label
    ) then
      raise exception 'cannot delete a taxonomy value still used by leads';
    end if;
    return old;
  end if;
  -- UPDATE: lock the identity of system rows (reorder / is_active / notes still allowed).
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
  return new;
end;
$$;

create trigger firm_taxonomies_guard
  before insert or update or delete on public.firm_taxonomies
  for each row execute function public.guard_firm_taxonomy();

-- RLS: read = any firm member (dropdowns + display are firm-wide); write = settings.manage.
alter table public.firm_taxonomies enable row level security;

create policy "firm_taxonomies_select_firm" on public.firm_taxonomies
  for select to authenticated
  using (firm_id = public.current_firm_id());

create policy "firm_taxonomies_write" on public.firm_taxonomies
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

-- Rename a custom taxonomy AND re-point every lead carrying the old label. SECURITY DEFINER so a
-- settings.manage admin WITHOUT leads.edit can still rewrite the firm's leads (the bulk leads
-- update would otherwise be blocked by leads RLS). DEFINER bypasses RLS, so we re-check
-- authorize('settings.manage') + firm membership explicitly inside.
create or replace function public.rename_firm_taxonomy(p_id uuid, p_label text)
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
  if v_old = p_label then
    return;
  end if;
  v_key := case v_cat
    when 'case_type' then 'caseType'
    when 'case_hierarchy' then 'hierarchy'
    when 'qualification' then 'qualification'
  end;
  update public.firm_taxonomies set label = p_label where id = p_id;  -- 23505 on duplicate
  update public.leads
    set data = jsonb_set(data, array[v_key], to_jsonb(p_label)), last_activity = now()
    where firm_id = v_firm and data ->> v_key = v_old;
end;
$$;

revoke execute on function public.rename_firm_taxonomy(uuid, text) from public;
grant execute on function public.rename_firm_taxonomy(uuid, text) to authenticated;
