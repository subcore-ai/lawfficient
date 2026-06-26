-- Attorney availability (spec 13 "Availability & calendar", Phase 1). Per-attorney weekly office hours
-- (Calendly-style) so consults can be booked into free slots within an attorney's hours. Slot generation
-- + the no-double-book exclusion constraint land in Phase 2.

-- Who takes consultations. Seeded true for existing attorneys; a firm can mark any staff schedulable
-- (multi-practice). The booking picker + the calendar list schedulable profiles.
alter table public.profiles add column if not exists schedulable boolean not null default false;
update public.profiles set schedulable = true where role = 'attorney';

-- Recurring weekly office hours. weekday 0=Sunday .. 6=Saturday (JS getDay / Postgres DOW). start/end are
-- naive wall times in the firm's timezone (firms.timezone). Multiple rows per (attorney, weekday) allow
-- split shifts, e.g. 09:00-12:00 + 13:00-17:00.
create table if not exists public.attorney_availability (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.current_firm_id() references public.firms (id) on delete cascade,
  attorney_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  data jsonb not null default '{}'::jsonb, -- practice-specific config hook (multi-practice)
  created_at timestamptz not null default now(),
  check (start_time < end_time),
  -- Tenant isolation: the attorney must belong to the row's firm. A plain id FK is RLS-bypassed, so use
  -- a COMPOSITE FK to profiles(id, firm_id) (profiles already has that unique key from 0008).
  constraint attorney_availability_attorney_fkey
    foreign key (attorney_id, firm_id) references public.profiles (id, firm_id) on delete cascade
);

create index if not exists attorney_availability_lookup_idx
  on public.attorney_availability (firm_id, attorney_id, weekday);

-- RLS: firm-scoped. Read for anyone who books (consultations.view — the calendar + slots need it);
-- writes are admin config (settings.manage). Inlines authorize() like the consultations / notes policies.
alter table public.attorney_availability enable row level security;

drop policy if exists "attorney_availability_select" on public.attorney_availability;
create policy "attorney_availability_select" on public.attorney_availability
  for select to authenticated
  using (
    firm_id = public.current_firm_id()
    -- Anyone who can WRITE office hours (settings.manage) must also READ them — otherwise the editor
    -- loads an empty schedule and a save wipes the real one. Booking reads via consultations.view.
    and (public.authorize('consultations.view') or public.authorize('settings.manage'))
  );

drop policy if exists "attorney_availability_insert" on public.attorney_availability;
create policy "attorney_availability_insert" on public.attorney_availability
  for insert to authenticated
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

drop policy if exists "attorney_availability_update" on public.attorney_availability;
create policy "attorney_availability_update" on public.attorney_availability
  for update to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

drop policy if exists "attorney_availability_delete" on public.attorney_availability;
create policy "attorney_availability_delete" on public.attorney_availability
  for delete to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

-- Atomic replace of an attorney's weekly office hours (delete-all + insert in ONE transaction), so a
-- mid-save failure can't leave them with no hours. SECURITY INVOKER: the delete + insert run under the
-- caller's RLS (settings.manage write + firm scope), firm_id defaults to current_firm_id() on insert,
-- and the composite FK then guarantees the attorney belongs to the caller's firm. Empty p_windows just
-- clears the schedule.
create or replace function public.set_attorney_availability(p_attorney_id uuid, p_windows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.attorney_availability where attorney_id = p_attorney_id;
  insert into public.attorney_availability (attorney_id, weekday, start_time, end_time)
  select p_attorney_id, (w->>'weekday')::smallint, (w->>'startTime')::time, (w->>'endTime')::time
  from jsonb_array_elements(p_windows) as w;
end;
$$;
