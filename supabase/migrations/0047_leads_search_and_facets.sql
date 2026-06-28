-- Leads-list pagination support. The list used to load every row (select *) and filter/count client-side,
-- which silently truncates past PostgREST's 1000-row cap. This adds the server-side primitives so the page can
-- paginate + count correctly:
--   1. search_text — a generated, lower-cased haystack (name / email / phone / city) mirroring the old
--      client search, so a single ILIKE matches the same way (incl. a full "first last" query).
--   2. a trigram GIN index so that ILIKE '%q%' stays fast well past 1000 rows.
--   3. lead_facets() — the per-status pipeline counts + archived count in one RLS-scoped round-trip, computed
--      in the DB instead of by loading + counting every lead.

create extension if not exists pg_trgm with schema extensions;

-- Only immutable inputs (text columns + a constant-key jsonb ->>), so it's valid as a STORED generated column.
alter table public.leads
  add column search_text text generated always as (
    lower(
      coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' ||
      coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(data ->> 'city', '')
    )
  ) stored;

create index leads_search_text_trgm on public.leads using gin (search_text extensions.gin_trgm_ops);

-- Per-status counts (non-archived) + the archived count, one round-trip. SECURITY INVOKER so the caller's
-- leads RLS scopes it to their firm; STABLE + empty search_path per the security checklist.
create or replace function public.lead_facets()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'statusCounts', coalesce(
      (
        select jsonb_object_agg(status_id, c)
        from (select status_id, count(*) as c from public.leads where archived = false group by status_id) s
      ),
      '{}'::jsonb
    ),
    'archived', (select count(*) from public.leads where archived = true)
  );
$$;
