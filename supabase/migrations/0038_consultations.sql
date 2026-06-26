-- Consultations go live (spec 13). Refactors the dormant 0002 consultations table into the live
-- pattern Leads uses: a lean typed core every practice shares + a `data` jsonb for practice-specific
-- fields, firm-scoped RLS keyed to the consultations.* permissions (which already exist in
-- app_permission). A consultation attaches to a LEAD (the contact) — "client" is just a later status
-- on that same lead, so there is NO separate client record here.
--
-- Payment is TRACK-ONLY for now (paid + amount); actual card processing lands with the Billing module.
-- `type` stays free text (firm-pickable in the UI) — wiring it to a firm-managed taxonomy is a
-- fast-follow; `data` jsonb already absorbs any practice-specific fields.

-- Drop the denormalized name (resolve it live from the lead, like leads do assignees) and the
-- case-specific column (case-type belongs on a case, which comes later). Add the live-pattern fields.
alter table public.consultations
  drop column if exists lead_name,
  drop column if exists case_type,
  add column if not exists outcome text,                            -- post-consult qualification; null until set
  add column if not exists data jsonb not null default '{}'::jsonb, -- practice-specific fields (multi-practice hook)
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists last_activity timestamptz not null default now();

create index if not exists consultations_lead_id_idx on public.consultations (lead_id);
create index if not exists consultations_attorney_id_idx on public.consultations (attorney_id);
create index if not exists consultations_start_at_idx on public.consultations (firm_id, start_at desc);

-- Tenant isolation: a consult's lead + attorney must belong to the SAME firm. A plain id FK is
-- bypassed by RLS (referential checks run as the table owner), so a known cross-firm id could be
-- linked. Use COMPOSITE FKs to (id, firm_id) — the pattern leads.status_id uses. ON DELETE SET NULL
-- nulls only the referencing id (firm_id is NOT NULL and stays).
-- leads needs a (id, firm_id) unique key for the composite FK to reference (profiles already has one
-- from 0008). `id` alone is the PK, so this just exposes the referenceable composite key.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_id_firm_id_key') then
    alter table public.leads add constraint leads_id_firm_id_key unique (id, firm_id);
  end if;
end $$;

-- Null out any pre-existing rows whose lead/attorney isn't in the consult's firm, so adding the
-- composite FKs can't fail at deploy time. (The table is dormant/empty today, so this is a no-op now.)
update public.consultations c set lead_id = null
  where c.lead_id is not null
    and not exists (select 1 from public.leads l where l.id = c.lead_id and l.firm_id = c.firm_id);
update public.consultations c set attorney_id = null
  where c.attorney_id is not null
    and not exists (select 1 from public.profiles p where p.id = c.attorney_id and p.firm_id = c.firm_id);

alter table public.consultations drop constraint if exists consultations_lead_id_fkey;
alter table public.consultations drop constraint if exists consultations_attorney_id_fkey;
alter table public.consultations
  add constraint consultations_lead_id_fkey foreign key (lead_id, firm_id)
    references public.leads (id, firm_id) on delete set null (lead_id),
  add constraint consultations_attorney_id_fkey foreign key (attorney_id, firm_id)
    references public.profiles (id, firm_id) on delete set null (attorney_id);

-- audit_entity already includes 'consultation' (from the 0002 scaffold), so no enum change is needed.

-- RLS: firm-scoped, keyed to consultations.view / consultations.edit. Inlines authorize() exactly like
-- the leads/notes policies (authorize() is INVOKER + JWT-only; no SECURITY DEFINER helper needed). The
-- write side is split into INSERT + UPDATE (NOT a FOR ALL): there is no DELETE policy (consultations
-- are soft-deleted via `archived`), and read access stays solely on the consultations.view policy.
alter table public.consultations enable row level security;

drop policy if exists "consultations_select" on public.consultations;
create policy "consultations_select" on public.consultations
  for select to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('consultations.view'));

-- No DELETE policy (soft-delete via `archived`); drop a stray one if a prior run left it.
drop policy if exists "consultations_delete" on public.consultations;
drop policy if exists "consultations_write" on public.consultations;
drop policy if exists "consultations_insert" on public.consultations;
create policy "consultations_insert" on public.consultations
  for insert to authenticated
  with check (firm_id = public.current_firm_id() and public.authorize('consultations.edit'));

drop policy if exists "consultations_update" on public.consultations;
create policy "consultations_update" on public.consultations
  for update to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('consultations.edit'))
  with check (firm_id = public.current_firm_id() and public.authorize('consultations.edit'));

-- ── Consultation notes: extend the generic notes system (0028) to the 'consultation' entity ──────
-- The notes table was built entity-agnostic for exactly this ("extend the entity_type check + RLS per
-- entity as modules go real"). Read/write now authorizes on the OWNING entity's permission: lead notes
-- → leads.*, consultation notes → consultations.*.
-- Drop the existing entity_type CHECK by definition (name-agnostic) and re-add it widened.
do $$
declare cname text;
begin
  select conname into cname from pg_constraint
  where conrelid = 'public.notes'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%entity_type%';
  if cname is not null then execute format('alter table public.notes drop constraint %I', cname); end if;
end $$;
alter table public.notes add constraint notes_entity_type_check check (entity_type in ('lead', 'consultation'));

drop policy if exists "notes_select" on public.notes;
create policy "notes_select" on public.notes
  for select to authenticated
  using (
    firm_id = public.current_firm_id()
    and (
      (entity_type = 'lead' and public.authorize('leads.view'))
      or (entity_type = 'consultation' and public.authorize('consultations.view'))
    )
  );

drop policy if exists "notes_insert" on public.notes;
create policy "notes_insert" on public.notes
  for insert to authenticated
  with check (
    firm_id = public.current_firm_id()
    and created_by_id = (select auth.uid())
    and (
      (entity_type = 'lead' and public.authorize('leads.edit'))
      or (entity_type = 'consultation' and public.authorize('consultations.edit'))
    )
  );

drop policy if exists "notes_update" on public.notes;
create policy "notes_update" on public.notes
  for update to authenticated
  using (
    firm_id = public.current_firm_id()
    and kind = 'note'
    and (
      (entity_type = 'lead' and public.authorize('leads.edit'))
      or (entity_type = 'consultation' and public.authorize('consultations.edit'))
    )
  )
  with check (
    firm_id = public.current_firm_id()
    and kind = 'note'
    and (
      (entity_type = 'lead' and public.authorize('leads.edit'))
      or (entity_type = 'consultation' and public.authorize('consultations.edit'))
    )
  );
-- notes_delete stays as-is: author OR settings.manage, entity-agnostic.
