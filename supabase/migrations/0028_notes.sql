-- Generic, reusable note + activity timeline. A `notes` row is a timestamped, authored entry
-- attached to any entity via (entity_type, entity_id) — leads today; clients/cases/consultations
-- reuse it later by extending the entity_type check + RLS. `kind='note'` rows are user-authored and
-- can be ADDRESSED (resolved_at — collapses in the UI), HIDDEN (hidden_at — kept for history, off by
-- default), edited (edited_at), or hard-deleted by the author or an admin. `kind='event'` rows are
-- system-recorded lifecycle activity (status change, assignment, archive) — read-only: the update +
-- delete policies below allow only kind='note'. Replaces the single `leads.notes` text field.
--
-- Polymorphic by design: no per-entity FK (you can't FK one column to many tables). Firm teardown
-- still cascades via firm_id; leads are soft-archived so notes never dangle in the live flow; a
-- future DB-side hard-delete of an entity would orphan its notes (harmless — never queried for a
-- non-existent entity). RLS inlines authorize('leads.*') exactly like the `interactions` table
-- "rides on leads" (0014/0017) — no SECURITY DEFINER helper (authorize() is already INVOKER + JWT-only).

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default public.current_firm_id() references public.firms(id) on delete cascade,
  entity_type text not null check (entity_type in ('lead')),  -- extend per entity as modules go real
  entity_id uuid not null,
  body text not null check (length(btrim(body)) > 0),
  -- 'note' = user-authored (editable / addressable / hideable / deletable); 'event' = system-recorded
  -- lifecycle activity (status change, assignment, archive) — read-only via the RLS policies below.
  kind text not null default 'note' check (kind in ('note', 'event')),
  created_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,                                                     -- set when the body is edited
  resolved_at timestamptz,
  resolved_by_id uuid references public.profiles(id) on delete set null,
  hidden_at timestamptz,
  hidden_by_id uuid references public.profiles(id) on delete set null
);

create index notes_entity_idx on public.notes (firm_id, entity_type, entity_id, created_at desc);

-- RLS: read = leads.view, write = leads.edit (notes ride on the parent entity's permissions); delete
-- additionally allowed to the author. firm_id equality on every policy keeps tenancy airtight.
alter table public.notes enable row level security;

create policy "notes_select" on public.notes
  for select to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('leads.view'));

-- created_by_id = auth.uid() pins the author (profiles.id references auth.users(id)) — can't be forged.
create policy "notes_insert" on public.notes
  for insert to authenticated
  with check (
    firm_id = public.current_firm_id()
    and public.authorize('leads.edit')
    and created_by_id = (select auth.uid())
  );

-- UPDATE re-checks firm in WITH CHECK so a row can't be reparented to another firm. Body-edit is
-- author-only — enforced in the server action (a product rule, not a tenancy boundary); RLS stays
-- coarse at leads.edit so anyone who can edit the lead can address/hide a note.
create policy "notes_update" on public.notes
  for update to authenticated
  using (firm_id = public.current_firm_id() and public.authorize('leads.edit') and kind = 'note')
  with check (firm_id = public.current_firm_id() and public.authorize('leads.edit') and kind = 'note');

-- Delete: the author, or an admin (settings.manage). An orphaned-author note (created_by_id null
-- after the author leaves) is then deletable only by an admin.
create policy "notes_delete" on public.notes
  for delete to authenticated
  using (
    firm_id = public.current_firm_id()
    and kind = 'note'
    and (created_by_id = (select auth.uid()) or public.authorize('settings.manage'))
  );

-- The single free-text field the timeline replaces.
alter table public.leads drop column notes;
