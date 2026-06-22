-- Firm-defined lead pipeline stages, replacing the hardcoded `lead_status` enum. Each
-- firm gets its own seeded copy of the 9 default stages (mirroring the RBAC system
-- roles seed), editable/reorderable later via a settings UI. `leads.status_id`
-- (migration 0019) references these. The guard trigger + the leads FK live in 0019 —
-- they need `leads.status_id` to exist first.

create table public.lead_statuses (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.current_firm_id() references public.firms(id) on delete cascade,
  key text not null,
  name text not null,
  position int not null default 0,
  tone text not null default 'neutral'
    check (tone in ('neutral', 'info', 'success', 'warning', 'danger', 'purple')),
  is_terminal boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (firm_id, key),
  unique (id, firm_id)
);

create index lead_statuses_firm_id_idx on public.lead_statuses (firm_id);

-- Seed the 9 default stages for one firm (positions/tones/terminal mirror the old enum
-- + lib/status.ts). SECURITY DEFINER: runs from the migration + the new-firm trigger,
-- only ever writing system rows for the given firm.
create or replace function public.seed_lead_statuses(p_firm_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_statuses (firm_id, key, name, position, tone, is_terminal, is_system)
  values
    (p_firm_id, 'new',                'New',                 0, 'info',    false, true),
    (p_firm_id, 'contacted',          'Contacted',           1, 'info',    false, true),
    (p_firm_id, 'consult_scheduled',  'Consult scheduled',   2, 'purple',  false, true),
    (p_firm_id, 'scheduled_paid',     'Scheduled & paid',    3, 'purple',  false, true),
    (p_firm_id, 'qualified_followup', 'Qualified follow-up', 4, 'warning', false, true),
    (p_firm_id, 'ea_sent',            'EA sent',             5, 'warning', false, true),
    (p_firm_id, 'retained',           'Retained',            6, 'success', true,  true),
    (p_firm_id, 'not_qualified',      'Not qualified',       7, 'neutral', true,  true),
    (p_firm_id, 'lost',               'Lost',                8, 'neutral', true,  true)
  on conflict (firm_id, key) do nothing;
end;
$$;

-- Seed every existing firm.
select public.seed_lead_statuses(id) from public.firms;

-- New firms auto-seed the default stages (sibling to firms_seed_system_roles).
create or replace function public.seed_lead_statuses_on_firm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_lead_statuses(new.id);
  return new;
end;
$$;

create trigger firms_seed_lead_statuses
  after insert on public.firms
  for each row execute function public.seed_lead_statuses_on_firm();

-- Least privilege: SECURITY DEFINER seeds bypass RLS; only the migration + trigger call them.
revoke execute on function public.seed_lead_statuses(uuid) from public, anon, authenticated;
revoke execute on function public.seed_lead_statuses_on_firm() from public, anon, authenticated;

-- RLS (mirror roles): firm-scoped. Reading needs leads.view (the board lists stages);
-- writing (pipeline config) needs settings.manage. 100% permission-based — the
-- transition fallbacks (rbac_unstamped) were retired in 0017.
alter table public.lead_statuses enable row level security;

create policy "lead_statuses_select_firm" on public.lead_statuses
  for select to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('leads.view'));

create policy "lead_statuses_write" on public.lead_statuses
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));
