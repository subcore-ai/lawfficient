-- The ingest activity log is surfaced inside Settings → Integrations, which is gated on
-- settings.manage. 0021 gated webhook_events SELECT on leads.view, so a settings.manage-only
-- custom role can create + manage sources yet sees an empty activity log (RLS returns no rows).
-- Align the read with where the log is shown — settings.manage. The default admin holds both, so
-- it's unaffected; a leads.view-only role never reaches the settings.manage-gated UI anyway.
drop policy if exists "webhook_events_select_firm" on public.webhook_events;

create policy "webhook_events_select_firm" on public.webhook_events
  for select to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('settings.manage'));
