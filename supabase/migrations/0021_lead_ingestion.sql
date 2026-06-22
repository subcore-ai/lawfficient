-- Lead ingestion (spec 23, Tier 0): per-firm webhook sources + an append-only event log,
-- feeding the leads core via the canonical contract. The `data jsonb` column (0019) is the
-- verbatim-payload landing zone. Endpoint: POST /api/leads (Authorization: Bearer <key>).
-- Mirrors the lead_statuses (0018) per-firm + RLS + composite-FK patterns.

-- 1) Audit source config like roles/users (0010 added 'role'). Append-only; the value is NOT
--    used in this migration's transaction (the audit insert happens later, at runtime).
alter type public.audit_entity add value if not exists 'lead_source';

-- 2) Leads gain an idempotency key. `external_id` is the source's own record id; the partial
--    unique index dedupes re-deliveries per (firm, source) and never touches manual leads.
alter table public.leads add column external_id text;
create unique index leads_source_external_idx
  on public.leads (firm_id, source, external_id)
  where external_id is not null;

-- 3) lead_sources — a firm's configured inbound sources (one per Zap). The opaque API key is
--    stored only as a sha256 hash (+ last4 for display); the raw key is shown once at creation.
create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.current_firm_id() references public.firms(id) on delete cascade,
  key text not null check (key = btrim(key) and length(key) > 0),
  name text not null check (name = btrim(name) and length(name) > 0),
  kind text not null default 'webhook'
    check (kind in ('webhook', 'csv', 'web_form', 'connector', 'agent')),
  key_hash text not null,
  key_last4 text not null,
  default_assignee_id uuid references public.profiles (id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (firm_id, key),
  unique (id, firm_id),
  unique (key_hash)
);
create index lead_sources_firm_id_idx on public.lead_sources (firm_id);

alter table public.lead_sources enable row level security;

-- Config: read/write by settings.manage (firm-scoped). 100% permission-based (no fallbacks; 0017).
create policy "lead_sources_rw" on public.lead_sources
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

-- key_hash is a sha256 hash (irreversible) of a key the firm's own admin generated + saw
-- once, so it is safe for settings.manage users to read: it cannot be used to authenticate
-- (the endpoint hashes the incoming RAW key to compare), and storing only the hash means a
-- DB leak never exposes usable keys. The UI shows key_last4. (A column-level REVOKE would be
-- a no-op here — a table-level SELECT grant overrides it. HMAC signing, a real raw secret,
-- is deferred; when added it will live in a service-role-only table, not a readable column.)

-- 4) webhook_events — append-only ingest log (powers the activity view + the per-source rate
--    limit + future replay). raw_payload is the verbatim source body (FR-ingest-4).
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  source_id uuid not null,
  external_id text,
  status text not null
    check (status in ('received', 'normalized', 'upserted', 'duplicate', 'rejected')),
  lead_id uuid references public.leads (id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  error text,
  received_at timestamptz not null default now(),
  constraint webhook_events_source_firm_fk
    foreign key (source_id, firm_id) references public.lead_sources (id, firm_id) on delete cascade
);
create index webhook_events_source_idx on public.webhook_events (firm_id, source_id, received_at desc);

alter table public.webhook_events enable row level security;

-- Read-only log for leads.view holders; only the service-role endpoint inserts (no write policy).
create policy "webhook_events_select_firm" on public.webhook_events
  for select to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('leads.view'));
