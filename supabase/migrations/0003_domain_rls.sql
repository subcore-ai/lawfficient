-- Phase 0 RLS for domain tables: strict firm_id isolation.
-- Every authenticated user may read/write only rows in their own firm. Finer
-- role rules (e.g. File Clerk not seeing invoice amounts) are layered on per
-- feature slice — the firm boundary here is the non-negotiable security floor.

-- Standard tables get the full SELECT/INSERT/UPDATE/DELETE firm-scoped set.
do $$
declare
  t text;
  tables text[] := array[
    'leads', 'interactions', 'consultations', 'clients',
    'immigration_cases', 'deadlines', 'case_tasks', 'invoices', 'documents'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);

    execute format($f$
      create policy "%1$s_select" on public.%1$I
        for select to authenticated
        using (firm_id = public.current_firm_id());
    $f$, t);

    execute format($f$
      create policy "%1$s_insert" on public.%1$I
        for insert to authenticated
        with check (firm_id = public.current_firm_id());
    $f$, t);

    execute format($f$
      create policy "%1$s_update" on public.%1$I
        for update to authenticated
        using (firm_id = public.current_firm_id())
        with check (firm_id = public.current_firm_id());
    $f$, t);

    execute format($f$
      create policy "%1$s_delete" on public.%1$I
        for delete to authenticated
        using (firm_id = public.current_firm_id());
    $f$, t);
  end loop;
end $$;

-- Audit log: firm-scoped read + insert only. It is append-only — no user
-- updates or deletes.
alter table public.audit_log enable row level security;
create policy "audit_log_select" on public.audit_log
  for select to authenticated
  using (firm_id = public.current_firm_id());
create policy "audit_log_insert" on public.audit_log
  for insert to authenticated
  with check (firm_id = public.current_firm_id());
