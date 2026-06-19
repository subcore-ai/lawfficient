-- Phase 0 domain tables, mirroring apps/app/data/types.ts.
-- Every table carries firm_id (the tenancy boundary). Money is numeric(12,2).
-- Dates that are calendar-only use date; event timestamps use timestamptz.

-- ---------------------------------------------------------------- Leads
create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.firms(id) on delete cascade,
  first_name         text not null,
  last_name          text not null,
  phone              text not null default '',
  email              text not null default '',
  source             text not null,
  status             public.lead_status not null default 'new',
  qualification      public.qualification not null default 'pending',
  case_type          text,
  hierarchy          text check (hierarchy in ('HRC', 'NHRC')),
  assigned_to_id     uuid references public.profiles(id) on delete set null,
  preferred_language text not null default '',
  country_of_origin  text not null default '',
  city               text not null default '',
  state              text not null default '',
  notes              text,
  archived           boolean not null default false,
  created_at         timestamptz not null default now(),
  last_activity      timestamptz not null default now()
);
create index leads_firm_id_idx on public.leads (firm_id);
create index leads_assigned_to_idx on public.leads (assigned_to_id);

-- Lead activity / disposition log.
create table public.interactions (
  id        uuid primary key default gen_random_uuid(),
  firm_id   uuid not null references public.firms(id) on delete cascade,
  lead_id   uuid not null references public.leads(id) on delete cascade,
  type      text not null check (type in ('call', 'sms', 'email', 'note', 'disposition')),
  summary   text not null,
  by_id     uuid references public.profiles(id) on delete set null,
  at        timestamptz not null default now()
);
create index interactions_lead_id_idx on public.interactions (lead_id);

-- ---------------------------------------------------------------- Consultations
create table public.consultations (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete set null,
  lead_name     text not null,
  attorney_id   uuid references public.profiles(id) on delete set null,
  type          text not null,
  paid          boolean not null default false,
  amount        numeric(12,2),
  status        public.consultation_status not null default 'scheduled',
  start_at      timestamptz not null,
  duration_min  integer not null default 30,
  time_zone     text not null default 'America/New_York',
  case_type     text,
  booked_by_id  uuid references public.profiles(id) on delete set null,
  archived      boolean not null default false
);
create index consultations_firm_id_idx on public.consultations (firm_id);
create index consultations_lead_id_idx on public.consultations (lead_id);

-- ---------------------------------------------------------------- Clients
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firms(id) on delete cascade,
  lead_id         uuid references public.leads(id) on delete set null,
  name            text not null,
  case_type       text not null,
  status          public.client_status not null default 'active',
  la_id           uuid references public.profiles(id) on delete set null,
  date_hired      date not null default current_date,
  total_fees      numeric(12,2) not null default 0,
  paid            numeric(12,2) not null default 0,
  balance         numeric(12,2) not null default 0,
  payment_status  public.payment_status not null default 'current',
  archived        boolean not null default false
);
create index clients_firm_id_idx on public.clients (firm_id);

-- ---------------------------------------------------------------- Cases
create table public.immigration_cases (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references public.firms(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  client_name         text not null,
  case_type           text not null,
  hierarchy           text not null default 'NHRC' check (hierarchy in ('HRC', 'NHRC')),
  difficulty          smallint not null default 1 check (difficulty between 1 and 3),
  status              public.case_status not null default 'onboarding',
  stage               integer not null default 1,
  red_flag            public.red_flag not null default 'none',
  la_id               uuid references public.profiles(id) on delete set null,
  attorney_id         uuid references public.profiles(id) on delete set null,
  date_hired          date not null default current_date,
  expected_mailing    date,
  checklist_complete  integer not null default 0 check (checklist_complete between 0 and 100),
  open_deadlines      integer not null default 0,
  archived            boolean not null default false
);
create index immigration_cases_firm_id_idx on public.immigration_cases (firm_id);
create index immigration_cases_client_id_idx on public.immigration_cases (client_id);

create table public.deadlines (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  case_id      uuid not null references public.immigration_cases(id) on delete cascade,
  client_name  text not null,
  kind         text not null check (kind in ('RFE', 'NOID', 'Denial', 'Abeyance Letter')),
  due_at       timestamptz not null,
  la_id        uuid references public.profiles(id) on delete set null,
  attorney_id  uuid references public.profiles(id) on delete set null,
  status       public.deadline_status not null default 'open'
);
create index deadlines_firm_id_idx on public.deadlines (firm_id);
create index deadlines_case_id_idx on public.deadlines (case_id);

create table public.case_tasks (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  case_id      uuid references public.immigration_cases(id) on delete cascade,
  title        text not null,
  assignee_id  uuid references public.profiles(id) on delete set null,
  due_label    text not null default '',
  status       public.task_status not null default 'not_started',
  priority     public.task_priority not null default 'normal'
);
create index case_tasks_firm_id_idx on public.case_tasks (firm_id);

-- ---------------------------------------------------------------- Billing
create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  number         text not null,
  client_id      uuid references public.clients(id) on delete cascade,
  client_name    text not null,
  case_type      text,
  total          numeric(12,2) not null default 0,
  paid           numeric(12,2) not null default 0,
  remaining      numeric(12,2) not null default 0,
  status         public.invoice_status not null default 'draft',
  type           public.payment_type not null default 'down_payment',
  due_at         timestamptz,
  months_behind  integer,
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index invoices_firm_id_idx on public.invoices (firm_id);
create index invoices_client_id_idx on public.invoices (client_id);

-- ---------------------------------------------------------------- Documents
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firms(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  case_id         uuid references public.immigration_cases(id) on delete set null,
  client_name     text not null,
  name            text not null,
  category        text not null,
  doc_type        text not null,
  case_type       text,
  uploaded_by_id  uuid references public.profiles(id) on delete set null,
  status          public.doc_status not null default 'pending',
  archived        boolean not null default false,
  uploaded_at     timestamptz not null default now()
);
create index documents_firm_id_idx on public.documents (firm_id);

-- ---------------------------------------------------------------- Audit log
-- by_user_id null = system action. entity_id is text to tolerate non-uuid keys.
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  entity      public.audit_entity not null,
  entity_id   text not null,
  label       text not null default '',
  action      text not null,
  by_user_id  uuid references public.profiles(id) on delete set null,
  at          timestamptz not null default now()
);
create index audit_log_firm_id_idx on public.audit_log (firm_id);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
