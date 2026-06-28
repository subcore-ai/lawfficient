-- Firm-wide holidays (spec 13 calendar fast-follow). An availability_exceptions row with attorney_id NULL
-- closes the date(s) for EVERY attorney — e.g. Christmas — instead of duplicating the entry onto each
-- attorney's time off. Only the NOT NULL is dropped; the existing RLS + FK already do the right thing:
--   • RLS (0044): the owner branch `attorney_id = auth.uid()` is FALSE for NULL, so a firm-wide row can only
--     be written by settings.manage (admin), while consultations.view / admins still read it for the calendar.
--   • The composite FK (attorney_id, firm_id) → profiles(id, firm_id) is MATCH SIMPLE, so a NULL attorney_id
--     bypasses the per-attorney check (a firm-wide row isn't tied to one profile) while firm_id stays enforced.
alter table public.availability_exceptions alter column attorney_id drop not null;
