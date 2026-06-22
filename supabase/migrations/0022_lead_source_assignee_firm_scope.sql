-- Firm-scope the lead_sources default assignee at the DB level.
--
-- 0021 used a simple FK to profiles(id), which let default_assignee_id point at a profile in
-- ANOTHER firm: RLS scopes which lead_sources row a settings.manage user may write, but not the
-- assignee *value*, so a crafted write could set a cross-firm assignee (a tenant-integrity gap,
-- though RLS still prevents the foreign user from seeing the lead). Replace it with a composite FK
-- against the profiles (id, firm_id) unique key so the assignee must live in the source's firm.
--
-- The reason 0021 didn't do this: a plain composite ON DELETE SET NULL would try to null firm_id
-- too (it's NOT NULL → error). PG15's column-list form nulls ONLY default_assignee_id when the
-- referenced profile is deleted, leaving firm_id intact — so this never blocks profile deletion
-- or firm teardown.
alter table public.lead_sources
  drop constraint if exists lead_sources_default_assignee_id_fkey;

alter table public.lead_sources
  add constraint lead_sources_assignee_firm_fk
  foreign key (default_assignee_id, firm_id)
  references public.profiles (id, firm_id)
  on delete set null (default_assignee_id);
