-- Phase 0 foundation: multi-tenant core (firms, profiles, pods, packet stages)
-- and the firm-scoping helper that every RLS policy relies on.
--
-- Tenancy model: every row carries firm_id. A user only ever sees rows whose
-- firm_id matches their own profile's firm_id. That boundary is enforced by RLS
-- (the primary control); the app's can() matrix is only for hiding UI.

-- ---------------------------------------------------------------- Enums
-- Closed-set, snake_case status fields mirror apps/app/data/types.ts.
-- Human-facing, firm-configurable sets (case types, lead sources, doc
-- categories) are left as text so admins can extend them later (spec 22).

create type public.staff_role as enum (
  'admin', 'attorney', 'la_lead', 'legal_assistant', 'qa_lead',
  'creative_writer', 'sales', 'accounts_receivable', 'file_clerk'
);
create type public.staff_status as enum ('active', 'invited', 'disabled');

create type public.lead_status as enum (
  'new', 'contacted', 'consult_scheduled', 'scheduled_paid',
  'qualified_followup', 'ea_sent', 'retained', 'not_qualified', 'lost'
);
create type public.qualification as enum ('qualified', 'not_qualified', 'pending');

create type public.consultation_status as enum (
  'scheduled', 'paid', 'completed', 'rescheduled', 'canceled', 'no_show'
);

create type public.case_status as enum (
  'onboarding', 'packet_prep', 'in_review', 'filed', 'rfe', 'approved'
);
create type public.red_flag as enum ('none', 'red_flag_client', 'red_flag_packet');
create type public.deadline_status as enum ('open', 'responded', 'overdue');
create type public.task_status as enum ('not_started', 'in_progress', 'completed');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');

create type public.client_status as enum (
  'active', 'monthly_plan', 'on_hold', 'completed', 'terminated'
);
create type public.payment_status as enum (
  'current', 'overdue', 'paid', 'payment_arrangement'
);

create type public.invoice_status as enum (
  'draft', 'sent', 'partial', 'paid', 'overdue', 'void'
);
create type public.payment_type as enum (
  'down_payment', 'monthly', 'full_payment', 'partial_down', 'consultation', 'filing_fee'
);

create type public.doc_status as enum ('pending', 'submitted', 'verified');
create type public.audit_entity as enum (
  'lead', 'consultation', 'client', 'case', 'invoice', 'document', 'user'
);

-- ---------------------------------------------------------------- Firms
create table public.firms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Pods (teams) — referenced by profiles, so created before them.
create table public.pods (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id) on delete cascade,
  name          text not null,
  lead_user_id  uuid,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- Profiles
-- One row per staff user, 1:1 with auth.users. This is the StaffUser type.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  firm_id     uuid not null references public.firms(id) on delete cascade,
  name        text not null,
  email       text not null,
  initials    text not null default '',
  role        public.staff_role not null default 'sales',
  status      public.staff_status not null default 'invited',
  pod_id      uuid references public.pods(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index profiles_firm_id_idx on public.profiles (firm_id);

-- Now that profiles exists, point pods.lead_user_id at it.
alter table public.pods
  add constraint pods_lead_user_id_fkey
  foreign key (lead_user_id) references public.profiles(id) on delete set null;

-- Firm-configurable packet pipeline (spec 15/22).
create table public.packet_stages (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  name        text not null,
  sla_days    integer not null default 1,
  position    integer not null default 0
);
create index packet_stages_firm_id_idx on public.packet_stages (firm_id);

-- ---------------------------------------------------------------- Firm scoping
-- Returns the calling user's firm_id. SECURITY DEFINER so it can read profiles
-- without recursing through profiles' own RLS. It only ever returns the
-- caller's own firm_id (keyed by auth.uid()), so it leaks nothing cross-tenant.
-- Follow-up optimization: move firm_id into a JWT app_metadata claim via a
-- custom access token hook and read auth.jwt() instead of this lookup.
create or replace function public.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select firm_id from public.profiles where id = (select auth.uid())
$$;

create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

revoke execute on function public.current_firm_id() from public;
revoke execute on function public.current_staff_role() from public;
grant execute on function public.current_firm_id() to authenticated, service_role;
grant execute on function public.current_staff_role() to authenticated, service_role;

-- Auto-scope inserts to the caller's firm. Now that current_firm_id() exists,
-- default these firm-managed tables to it (RLS WITH CHECK still blocks forging
-- another firm's id). profiles is excluded: its firm_id is set by the signup
-- trigger from app_metadata, before any profile row exists to look up.
alter table public.pods          alter column firm_id set default public.current_firm_id();
alter table public.packet_stages alter column firm_id set default public.current_firm_id();

-- ---------------------------------------------------------------- RLS: core
alter table public.firms enable row level security;
alter table public.pods enable row level security;
alter table public.profiles enable row level security;
alter table public.packet_stages enable row level security;

-- A user sees only their own firm.
create policy "firms_select_own" on public.firms
  for select to authenticated
  using (id = public.current_firm_id());

-- Profiles: visible within the firm; a user may update their own row; admins
-- manage everyone in the firm.
create policy "profiles_select_firm" on public.profiles
  for select to authenticated
  using (firm_id = public.current_firm_id());
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and firm_id = public.current_firm_id());
create policy "profiles_admin_write" on public.profiles
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin')
  with check (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin');

-- Pods + packet stages: firm-scoped read; admins write.
create policy "pods_select_firm" on public.pods
  for select to authenticated
  using (firm_id = public.current_firm_id());
create policy "pods_admin_write" on public.pods
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin')
  with check (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin');

create policy "packet_stages_select_firm" on public.packet_stages
  for select to authenticated
  using (firm_id = public.current_firm_id());
create policy "packet_stages_admin_write" on public.packet_stages
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin')
  with check (firm_id = public.current_firm_id() and public.current_staff_role() = 'admin');
