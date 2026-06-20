-- Phase 2b, step 2 (spec 25, FR-rbac-5 + acceptance "RLS denies even if the UI is
-- bypassed"): add per-module authorize() enforcement to the domain data tables.
-- Until now they were firm-only (0003) — per-module edit was UI-gated only, so a
-- raw API call bypassing the UI wasn't blocked. This makes the database the gate.
--
-- TRANSITION-SAFE: each policy keeps `or public.rbac_unstamped()`. Before the
-- access-token hook is registered on an environment, JWTs carry no
-- app_metadata.permissions claim, so rbac_unstamped() is true and the policy falls
-- back to firm-only (today's behavior) — no lockout. The moment the hook goes live
-- and stamps permissions, enforcement activates automatically. A later migration can
-- drop the fallback once the hook is permanently verified on remote.
--
-- Mapping (module.action): reads -> *.view, writes (insert/update/delete) -> *.edit
-- (the vocabulary has no separate delete permission). interactions ride on leads;
-- deadlines + case_tasks ride on cases; invoices are billing (read also allows
-- billing.view_status so status-only roles see rows — amount redaction stays a UI
-- concern); documents are their own module.

-- True when the hook hasn't stamped a permissions claim into this JWT (e.g. not yet
-- registered here). SECURITY INVOKER: reads only the caller's own JWT.
create or replace function public.rbac_unstamped()
returns boolean
language sql
stable
set search_path = ''
as $$
  select not coalesce(auth.jwt() -> 'app_metadata' ? 'permissions', false);
$$;

-- Standard data tables: read -> view, write -> edit.
do $$
declare
  r record;
begin
  for r in (
    select * from (values
      ('leads',             'leads.view',         'leads.edit'),
      ('interactions',      'leads.view',         'leads.edit'),
      ('consultations',     'consultations.view', 'consultations.edit'),
      ('clients',           'clients.view',       'clients.edit'),
      ('immigration_cases', 'cases.view',         'cases.edit'),
      ('deadlines',         'cases.view',         'cases.edit'),
      ('case_tasks',        'cases.view',         'cases.edit'),
      ('documents',         'documents.view',     'documents.edit')
    ) as v(tbl, view_perm, edit_perm)
  )
  loop
    execute format($f$
      alter policy "%1$s_select" on public.%1$I
        using (firm_id = public.current_firm_id()
               and (public.authorize(%2$L) or public.rbac_unstamped()));
    $f$, r.tbl, r.view_perm);

    execute format($f$
      alter policy "%1$s_insert" on public.%1$I
        with check (firm_id = public.current_firm_id()
                    and (public.authorize(%2$L) or public.rbac_unstamped()));
    $f$, r.tbl, r.edit_perm);

    execute format($f$
      alter policy "%1$s_update" on public.%1$I
        using (firm_id = public.current_firm_id()
               and (public.authorize(%2$L) or public.rbac_unstamped()))
        with check (firm_id = public.current_firm_id()
                    and (public.authorize(%2$L) or public.rbac_unstamped()));
    $f$, r.tbl, r.edit_perm);

    execute format($f$
      alter policy "%1$s_delete" on public.%1$I
        using (firm_id = public.current_firm_id()
               and (public.authorize(%2$L) or public.rbac_unstamped()));
    $f$, r.tbl, r.edit_perm);
  end loop;
end $$;

-- Invoices: reading allows billing.view OR billing.view_status (file clerks see
-- payment status); writing needs billing.edit.
alter policy "invoices_select" on public.invoices
  using (firm_id = public.current_firm_id()
         and (public.authorize('billing.view') or public.authorize('billing.view_status')
              or public.rbac_unstamped()));
alter policy "invoices_insert" on public.invoices
  with check (firm_id = public.current_firm_id()
              and (public.authorize('billing.edit') or public.rbac_unstamped()));
alter policy "invoices_update" on public.invoices
  using (firm_id = public.current_firm_id()
         and (public.authorize('billing.edit') or public.rbac_unstamped()))
  with check (firm_id = public.current_firm_id()
              and (public.authorize('billing.edit') or public.rbac_unstamped()));
alter policy "invoices_delete" on public.invoices
  using (firm_id = public.current_firm_id()
         and (public.authorize('billing.edit') or public.rbac_unstamped()));

-- Audit log: viewing is a reporting feature (reporting.view); inserting stays open
-- (any member's action writes audit entries, so it must not require a permission).
alter policy "audit_log_select" on public.audit_log
  using (firm_id = public.current_firm_id()
         and (public.authorize('reporting.view') or public.rbac_unstamped()));
