-- Firm-configurable consultation types (spec 13). A type bundles a name + default duration + price so
-- booking can pick a type and auto-fill those — the slot engine (Phase 2) then offers slots of the
-- type's length. Consultations DENORMALIZE the chosen values (type name + duration_min + paid + amount),
-- so editing or deleting a type never changes a past consultation; that's why this table needs no
-- in-use guard or rename-propagation (unlike firm_taxonomies). Modeled on 0024: per-firm seeded rows +
-- a firm-read / settings.manage-write RLS split.

create table public.consultation_types (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.current_firm_id() references public.firms (id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) > 0),
  duration_min integer not null check (duration_min > 0 and duration_min <= 1440),
  price numeric not null default 0 check (price >= 0), -- default charge (0 = free); maps to consultations.amount
  position int not null default 0,
  is_active boolean not null default true,
  data jsonb not null default '{}'::jsonb, -- practice-specific config hook (color, online, ...)
  created_at timestamptz not null default now(),
  unique (firm_id, name)
);

create index consultation_types_firm_idx on public.consultation_types (firm_id, position);

-- Seed sensible defaults for one firm. SECURITY DEFINER: runs from the migration + the new-firm trigger
-- only. Practice-agnostic durations; firms set their own names / prices / paid.
create or replace function public.seed_consultation_types(p_firm_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.consultation_types (firm_id, name, duration_min, position)
  values
    (p_firm_id, 'Initial consultation', 30, 0),
    (p_firm_id, 'Case review',          60, 1),
    (p_firm_id, 'Follow-up',            30, 2)
  on conflict (firm_id, name) do nothing;
end;
$$;

-- Seed every existing firm.
select public.seed_consultation_types(id) from public.firms;

-- New firms auto-seed (sibling to firms_seed_firm_taxonomies).
create or replace function public.seed_consultation_types_on_firm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_consultation_types(new.id);
  return new;
end;
$$;

create trigger firms_seed_consultation_types
  after insert on public.firms
  for each row execute function public.seed_consultation_types_on_firm();

-- Least privilege: only the migration + trigger call the seeds.
revoke execute on function public.seed_consultation_types(uuid) from public, anon, authenticated;
revoke execute on function public.seed_consultation_types_on_firm() from public, anon, authenticated;

-- RLS: read = any firm member (the booking dropdown + display are firm-wide); write = settings.manage.
-- Split per-command (not one FOR ALL policy) so SELECT has a single policy — no multiple-permissive
-- overlap.
alter table public.consultation_types enable row level security;

create policy "consultation_types_select" on public.consultation_types
  for select to authenticated
  using (firm_id = public.current_firm_id());

create policy "consultation_types_insert" on public.consultation_types
  for insert to authenticated
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

create policy "consultation_types_update" on public.consultation_types
  for update to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

create policy "consultation_types_delete" on public.consultation_types
  for delete to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'));
