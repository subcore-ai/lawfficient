-- Idempotency-Key replay store for public-API writes (spec 26, "Idempotency (writes)" + the
-- "Idempotency-Key storage + TTL" open question). A client may send an `Idempotency-Key` header on
-- POST /api/leads (the per-firm API-key create path); a repeat with the SAME key returns the ORIGINAL
-- result instead of creating a second lead — mirroring ingestion's externalId idempotency, but for
-- direct API creates which have no externalId.
--
-- Server-side only: like webhook_endpoint_secrets (0035) and the API request path generally, the
-- write endpoints authenticate a KEY (no user session) and reach this table through the service-role
-- admin client. So RLS is ENABLED with NO policies — authenticated/anon are denied entirely; only the
-- admin client (which bypasses RLS, server-only) reads/writes it. There's no UI need to read a
-- replayed response.
create table public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  -- the key that performed the write; if the key is deleted, its idempotency records go with it.
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  -- the client-supplied Idempotency-Key header value (opaque). Bounded so a hostile caller can't store
  -- megabytes keyed off one create (the route also rejects oversize keys with a 400).
  idempotency_key text not null check (char_length(idempotency_key) <= 255),
  -- the stored original outcome, replayed verbatim on a repeat: the HTTP status + the JSON response
  -- body (the created lead in its public shape). NULL while the reservation is PENDING — reserve-first
  -- inserts the row BEFORE the create (the unique constraint is the concurrency gate), then fills it in
  -- on success. lead_id is kept for observability / cascade cleanup.
  lead_id uuid references public.leads(id) on delete set null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  -- Scope is per (firm, key): the same Idempotency-Key reused by a DIFFERENT key (or firm) is a
  -- distinct request, never a cross-tenant replay. firm_id leads for tenant-scoped lookups.
  unique (firm_id, api_key_id, idempotency_key)
);

alter table public.api_idempotency_keys enable row level security;
-- No policies on purpose: deny all role-based access; only the service-role admin client reaches it.

-- TTL sweep: idempotency records are only useful for the short window a client retries within. A
-- Vercel Cron (or a future scheduled job) can prune aged rows; this index keeps that sweep cheap.
-- (Records also cascade-delete with their key or firm.)
create index api_idempotency_keys_created_at_idx on public.api_idempotency_keys (created_at);
