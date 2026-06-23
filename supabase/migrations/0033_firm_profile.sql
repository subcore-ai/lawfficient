-- Firm profile: editable firm-level contact details + defaults, surfaced in
-- Settings → General. `firms` previously held only id / name / created_at.

alter table public.firms
  add column contact_email    text,
  add column phone            text,
  add column timezone         text,    -- IANA tz id, e.g. 'America/New_York'
  add column default_language text,
  add column consultation_fee integer check (consultation_fee is null or consultation_fee >= 0),  -- whole USD
  add column office_address    text;

-- Everyone in the firm can already READ their firm (firms_select_own, 0001).
-- Admins may edit the profile. `firms` is keyed by id (the row *is* the firm),
-- so scope on id, and gate writes on settings.manage (same convention as the
-- other admin-managed settings tables, e.g. firm_taxonomies in 0024).
create policy "firms_admin_update" on public.firms for update to authenticated
  using (id = public.current_firm_id() and public.authorize('settings.manage'))
  with check (id = public.current_firm_id() and public.authorize('settings.manage'));
