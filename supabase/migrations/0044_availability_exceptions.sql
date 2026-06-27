-- Time off / unavailability (spec 13 "Availability & calendar", Phase 5). Per-attorney full-day
-- exceptions — vacation, holidays, personal days. A date inside any of an attorney's ranges removes their
-- WHOLE day from the calendar: no slots are offered regardless of the recurring weekly office hours.
-- Self-service like office hours — an attorney manages their own; admins (settings.manage) manage anyone's.
-- (Firm-wide holidays + partial-day overrides are a deliberate fast-follow; see specs/_backlog.md.)

create table if not exists public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.current_firm_id() references public.firms (id) on delete cascade,
  attorney_id uuid not null,
  start_date date not null,
  end_date date not null, -- inclusive
  note text, -- optional label, e.g. "Vacation"
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  -- Tenant isolation: a plain id FK is RLS-bypassed, so use a COMPOSITE FK to profiles(id, firm_id) —
  -- the attorney must belong to the row's firm. Matches attorney_availability (0040).
  constraint availability_exceptions_attorney_fkey
    foreign key (attorney_id, firm_id) references public.profiles (id, firm_id) on delete cascade
);

create index if not exists availability_exceptions_lookup_idx
  on public.availability_exceptions (firm_id, attorney_id, start_date, end_date);

-- RLS mirrors attorney_availability (0040 + 0041): read for anyone who books (consultations.view) or
-- manages (settings.manage) or the owner; writes are admin (settings.manage) OR the owner when schedulable
-- — who is bookable stays admin-controlled, so a non-schedulable user can't seed their own calendar data
-- directly through the Data API. Split per-command policies (no "multiple permissive policies" warning).
alter table public.availability_exceptions enable row level security;

create policy "availability_exceptions_select" on public.availability_exceptions
  for select to authenticated
  using (
    firm_id = public.current_firm_id()
    and (
      public.authorize('consultations.view')
      or public.authorize('settings.manage')
      or attorney_id = (select auth.uid())
    )
  );

create policy "availability_exceptions_insert" on public.availability_exceptions
  for insert to authenticated
  with check (
    firm_id = public.current_firm_id()
    and (
      public.authorize('settings.manage')
      or (
        attorney_id = (select auth.uid())
        and (select schedulable from public.profiles where id = (select auth.uid()))
      )
    )
  );

create policy "availability_exceptions_delete" on public.availability_exceptions
  for delete to authenticated
  using (
    firm_id = public.current_firm_id()
    and (
      public.authorize('settings.manage')
      or (
        attorney_id = (select auth.uid())
        and (select schedulable from public.profiles where id = (select auth.uid()))
      )
    )
  );
