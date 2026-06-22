-- Restructure leads for flexibility: a lean typed core + a `data jsonb` column for the
-- variable demographic/case fields, and firm-defined statuses (status_id FK to
-- lead_statuses, 0018) replacing the lead_status enum. No prod data yet, so this is blunt.

-- 1) Flexible data column for the "rest" (demographics, case details, future
--    source-mapped/ingestion fields — spec 23 lands here with no schema churn).
alter table public.leads add column data jsonb not null default '{}'::jsonb;

-- 2) Firm-defined status FK — nullable first, backfilled from the old enum by key.
alter table public.leads add column status_id uuid;
update public.leads l
set status_id = s.id
from public.lead_statuses s
where s.firm_id = l.firm_id and s.key = l.status::text;

-- 3) Fold the demographic/case columns into `data` (only mock test rows exist today,
--    but keep them correct). jsonb_strip_nulls drops empty/null keys.
update public.leads
set data = jsonb_strip_nulls(jsonb_build_object(
  'caseType', case_type,
  'hierarchy', hierarchy,
  'qualification', qualification::text,
  'preferredLanguage', nullif(preferred_language, ''),
  'countryOfOrigin', nullif(country_of_origin, ''),
  'city', nullif(city, ''),
  'state', nullif(state, '')
));

-- 4) Composite FK for tenant isolation — a lead's status must be in the lead's firm.
--    on delete restrict: deleting a status with leads is blocked (the guard gives a
--    friendlier error first).
alter table public.leads
  add constraint leads_status_firm_fk foreign key (status_id, firm_id)
  references public.lead_statuses (id, firm_id) on delete restrict;

-- 5) status_id is now required (every enum value is a seeded key, so the backfill set all).
alter table public.leads alter column status_id set not null;

-- 6) Drop the columns folded into `data` + the old enum status column.
alter table public.leads
  drop column status,
  drop column qualification,
  drop column case_type,
  drop column hierarchy,
  drop column preferred_language,
  drop column country_of_origin,
  drop column city,
  drop column state;

-- 7) The enums are now unreferenced (only leads used them).
drop type public.lead_status;
drop type public.qualification;

-- 8) Indexes for the queryable facets (board group-by + source filter). No GIN on `data`
--    yet — it's display-only in v1; add `using gin (data jsonb_path_ops)` when spec-23
--    ingestion needs attribution/dedup queries over it.
create index leads_status_id_idx on public.leads (firm_id, status_id);
create index leads_source_idx on public.leads (firm_id, source);

-- 9) Guard the firm-defined statuses (now that leads.status_id exists). Mirrors
--    guard_system_role: forge-block on insert, immutability on update, and block
--    deleting a system status or one still in use.
create or replace function public.lead_status_in_use(p_status_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.leads where status_id = p_status_id);
$$;
revoke execute on function public.lead_status_in_use(uuid) from public, anon, authenticated;

create or replace function public.guard_lead_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_system and current_user in ('authenticated', 'anon') then
      raise exception 'system lead statuses can only be created by the system seed';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Allow the firm-teardown cascade (parent firm already gone; firm_exists is a
    -- SECURITY DEFINER helper since authenticated can't SELECT firms — see 0011).
    if not public.firm_exists(old.firm_id) then
      return old;
    end if;
    if old.is_system then
      raise exception 'system lead statuses cannot be deleted';
    end if;
    -- lead_status_in_use bypasses RLS (DEFINER) so a settings.manage admin without
    -- leads.view still gets an accurate in-use check.
    if public.lead_status_in_use(old.id) then
      raise exception 'cannot delete a lead status that still has leads';
    end if;
    return old;
  end if;
  -- UPDATE: a system status's key/is_system/firm are immutable (rename + reorder + tone
  -- stay editable); a custom status can't be promoted to a system one.
  if not old.is_system and new.is_system then
    raise exception 'cannot promote a custom lead status to a system status';
  end if;
  if old.is_system and (
    new.is_system is distinct from old.is_system
    or new.key is distinct from old.key
    or new.firm_id is distinct from old.firm_id
  ) then
    raise exception 'cannot change key, is_system, or firm of a system lead status';
  end if;
  return new;
end;
$$;

create trigger lead_statuses_guard
  before insert or update or delete on public.lead_statuses
  for each row execute function public.guard_lead_status();
