-- Idempotency-Key for public-API creates (spec 26, "Idempotency (writes)"). A client may send an
-- `Idempotency-Key` header on POST /api/leads (the per-firm API-key create path); a repeat with the
-- SAME key returns the ORIGINAL lead instead of creating a second — mirroring ingestion's externalId
-- idempotency, but for direct creates which have no externalId.
--
-- Server-side only: like webhook_endpoint_secrets (0035), the write endpoints authenticate a KEY (no
-- user session) and reach this table through the service-role admin client. RLS is ENABLED with NO
-- policies — authenticated/anon are denied entirely; only the admin client (which bypasses RLS,
-- server-only) and the SECURITY INVOKER function below (called as service_role) touch it.
create table public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  -- the key that performed the write; if the key is deleted, its idempotency records go with it.
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  -- the client-supplied Idempotency-Key header value (opaque). Bounded so a hostile caller can't store
  -- megabytes keyed off one create (the route also rejects oversize keys with a 400).
  idempotency_key text not null check (char_length(idempotency_key) <= 255),
  -- the lead this key created. The row is written ATOMICALLY with the lead (see api_create_lead), so a
  -- committed key ALWAYS points at a real lead — there is no pending/half-written state to reconcile.
  -- A repeat replays by re-reading + re-serializing this lead. Cascades if the lead is hard-deleted (a
  -- retry then legitimately re-creates, since the original outcome no longer exists).
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Scope is per (firm, key): the same Idempotency-Key reused by a DIFFERENT key (or firm) is a
  -- distinct request, never a cross-tenant replay. The unique constraint is also the concurrency gate
  -- inside api_create_lead — concurrent repeats serialize on it and the losers replay the winner.
  unique (firm_id, api_key_id, idempotency_key)
);

alter table public.api_idempotency_keys enable row level security;
-- No policies on purpose: deny all role-based access; only the service-role admin client reaches it.

-- TTL sweep: idempotency records are only useful for the short window a client retries within. A
-- Vercel Cron (or a future scheduled job) can prune aged rows; this index keeps that sweep cheap.
create index api_idempotency_keys_created_at_idx on public.api_idempotency_keys (created_at);

-- Atomic create-with-idempotency. Inserts the lead AND records its idempotency key in ONE transaction,
-- so the two can never diverge: there is no window where a lead exists but its key wasn't recorded
-- (which previously could wedge the key on 409 or, after a stale reclaim, duplicate the lead). When an
-- Idempotency-Key is supplied, the unique (firm, key, idempotency_key) constraint elects exactly one
-- winner among concurrent repeats — the losers block on it, then replay the winner's lead. A create
-- that fails for any reason rolls the whole transaction back, leaving NO reservation behind.
--
-- SECURITY INVOKER: runs as the caller. The admin client calls it as service_role (which bypasses
-- RLS), and EXECUTE is granted ONLY to service_role below — so it is not a public endpoint. Returns
-- the full lead row (the route serializes it) plus `replayed` (true → a prior create was returned, so
-- the route emits no duplicate lead.created event).
-- Nullable inputs (assignee, and the idempotency pair) carry DEFAULT NULL so the generated TS type
-- marks them optional — the caller omits them rather than passing an awkward null. Defaulted params
-- must come last, hence the ordering.
create or replace function public.api_create_lead(
  p_firm_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_source text,
  p_status_id uuid,
  p_data jsonb,
  p_assigned_to_id uuid default null,
  p_api_key_id uuid default null,
  p_idempotency_key text default null
)
returns table (
  id uuid,
  firm_id uuid,
  first_name text,
  last_name text,
  phone text,
  email text,
  source text,
  external_id text,
  assigned_to_id uuid,
  status_id uuid,
  archived boolean,
  created_at timestamptz,
  last_activity timestamptz,
  data jsonb,
  replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
begin
  if p_idempotency_key is not null then
    begin
      insert into public.leads (
        firm_id, first_name, last_name, phone, email, source, assigned_to_id, status_id, data
      ) values (
        p_firm_id, p_first_name, p_last_name, p_phone, p_email, p_source,
        p_assigned_to_id, p_status_id, coalesce(p_data, '{}'::jsonb)
      ) returning leads.id into v_lead_id;

      insert into public.api_idempotency_keys (firm_id, api_key_id, idempotency_key, lead_id)
      values (p_firm_id, p_api_key_id, p_idempotency_key, v_lead_id);

      return query
        select l.id, l.firm_id, l.first_name, l.last_name, l.phone, l.email, l.source, l.external_id,
               l.assigned_to_id, l.status_id, l.archived, l.created_at, l.last_activity, l.data, false
        from public.leads l
        where l.id = v_lead_id;
      return;
    exception
      when unique_violation then
        -- A concurrent or repeated request with the same key already committed (rolling back our own
        -- lead insert above). Replay ITS lead.
        return query
          select l.id, l.firm_id, l.first_name, l.last_name, l.phone, l.email, l.source, l.external_id,
                 l.assigned_to_id, l.status_id, l.archived, l.created_at, l.last_activity, l.data, true
          from public.leads l
          join public.api_idempotency_keys k on k.lead_id = l.id
          where k.firm_id = p_firm_id
            and k.api_key_id = p_api_key_id
            and k.idempotency_key = p_idempotency_key;
        return;
    end;
  end if;

  -- No Idempotency-Key: a plain create.
  insert into public.leads (
    firm_id, first_name, last_name, phone, email, source, assigned_to_id, status_id, data
  ) values (
    p_firm_id, p_first_name, p_last_name, p_phone, p_email, p_source,
    p_assigned_to_id, p_status_id, coalesce(p_data, '{}'::jsonb)
  ) returning leads.id into v_lead_id;

  return query
    select l.id, l.firm_id, l.first_name, l.last_name, l.phone, l.email, l.source, l.external_id,
           l.assigned_to_id, l.status_id, l.archived, l.created_at, l.last_activity, l.data, false
    from public.leads l
    where l.id = v_lead_id;
end;
$$;

-- Not a public endpoint: only the service-role admin client may call it.
revoke all on function public.api_create_lead(
  uuid, text, text, text, text, text, uuid, jsonb, uuid, uuid, text
) from public;
grant execute on function public.api_create_lead(
  uuid, text, text, text, text, text, uuid, jsonb, uuid, uuid, text
) to service_role;
