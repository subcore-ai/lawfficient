-- Permanently delete a consultation. 0038 deliberately shipped NO delete policy (soft-delete via
-- `archived`), so a hard delete was blocked by RLS. This adds a firm-scoped DELETE policy gated on
-- consultations.edit, enabling the "Delete consultation" action — a complete removal, not a soft cancel.
drop policy if exists "consultations_delete" on public.consultations;
create policy "consultations_delete" on public.consultations
  for delete to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('consultations.edit'));
