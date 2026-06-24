-- Public API keys (spec 26, Phase 1): per-firm Bearer keys for the REST API at /api/**.
-- Distinct from lead_sources (0021), which are per-SOURCE, ingestion-only — these are
-- per-FIRM and scoped to the public API. Same hashing + firm-from-key model: the raw key
-- is shown to the admin once at creation; only its sha256 hash (+ last4 for display) is
-- stored, so a DB leak never yields a usable key. The API request path resolves the firm
-- from the hashed key via the service-role admin client (RLS does not apply there); these
-- policies are for the future Settings → Integrations management UI.
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.current_firm_id() references public.firms(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_last4 text not null,
  scopes text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index api_keys_firm_id_idx on public.api_keys (firm_id);

alter table public.api_keys enable row level security;

-- Management: read/write by a firm's admins (settings.manage), firm-scoped. Mirrors the
-- lead_sources_rw policy (0021). key_hash is an irreversible sha256 of a key the admin
-- generated + saw once, so it is safe for settings.manage users to read — it cannot be used
-- to authenticate (the API hashes the incoming RAW key to compare). 100% permission-based.
create policy "api_keys_rw" on public.api_keys
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (firm_id = public.current_firm_id() and public.authorize('settings.manage'));
