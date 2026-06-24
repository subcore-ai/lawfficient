-- Outbound webhooks (spec 27, Phase 1): the platform PUSHES lifecycle events to URLs a firm
-- registers, so their tools react in real time without polling. The inverse of the inbound lead
-- ingestion ([23], webhook_events) — same per-firm, hashed-secret, observability ethos, pointed
-- the other way (system → firm). Distinct from webhook_events: that logs INBOUND ingest deliveries,
-- these tables register OUTBOUND endpoints + log OUTBOUND deliveries. Keep them separate.

-- A firm's registered endpoints. Mirrors api_keys (0034): the signing secret is shown to the admin
-- once at creation; on this (admin-readable) table only its sha256 hash (+ last4 for display) is
-- stored, so a leak of THIS table never yields a usable secret. The raw secret the emitter needs to
-- HMAC-sign deliveries lives in the separate, service-role-only webhook_endpoint_secrets table
-- below — exactly as 0021 (line 49) prescribed ("a real raw secret … will live in a service-role-
-- only table, not a readable column"). These policies are for the Settings → Integrations UI.
create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.current_firm_id() references public.firms(id) on delete cascade,
  url text not null,
  secret_hash text not null,
  secret_last4 text not null,
  event_types text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index webhook_endpoints_firm_id_idx on public.webhook_endpoints (firm_id);

alter table public.webhook_endpoints enable row level security;

-- Management: read/write by a firm's admins (settings.manage), firm-scoped. Mirrors api_keys_rw
-- (0034). secret_hash is an irreversible sha256 of a secret the admin generated + saw once, so it's
-- safe for settings.manage users to read — it can't be used to sign (the signer needs the RAW
-- secret, which lives only in the service-role-only webhook_endpoint_secrets table). 100%
-- permission-based.
create policy "webhook_endpoints_rw" on public.webhook_endpoints
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));

-- The raw signing secret, isolated. The emitter must HMAC-sign each delivery with the RAW secret,
-- but a one-way hash can't sign and an admin-readable column would defeat the "leak yields nothing
-- usable" property — so the raw secret lives here, in a table with RLS ENABLED and NO policies:
-- authenticated/anon are denied entirely, and only the service-role admin client (which bypasses
-- RLS, and is server-only) reads it to sign or writes it on create. This is the "service-role-only
-- table, not a readable column" 0021 (line 49) called for. Plaintext-at-rest is acceptable for
-- Phase 1 (consistent with lead_sources.key); encrypting it / a KMS is a follow-up.
create table public.webhook_endpoint_secrets (
  endpoint_id uuid primary key references public.webhook_endpoints(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  secret text not null,
  created_at timestamptz not null default now()
);

alter table public.webhook_endpoint_secrets enable row level security;
-- No policies on purpose: deny all role-based access; only the service-role admin client reaches it.

-- The delivery log: one row per attempt to POST an event to an endpoint, with its outcome. Reuses
-- the disposition/observability pattern of webhook_events ([23]). Inserts + status updates go
-- through the service-role admin client (the worker has no user session), so there's no write
-- policy — only a SELECT policy for the firm's admins to view + (later) replay deliveries.
create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  attempts integer not null default 0,
  response_status integer,
  error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index webhook_deliveries_firm_idx on public.webhook_deliveries (firm_id, created_at desc);
create index webhook_deliveries_endpoint_idx on public.webhook_deliveries (endpoint_id, created_at desc);

alter table public.webhook_deliveries enable row level security;

-- Read-only log for settings.manage holders (the deliveries view lives in the settings.manage-gated
-- Integrations UI, aligned with webhook_events' read in 0023). Only the service-role delivery path
-- inserts/updates — no write policy.
create policy "webhook_deliveries_select_firm" on public.webhook_deliveries
  for select to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'));
