-- Harden the notes timeline against forged activity (review feedback on #27). Two rules, one guard
-- (mirrors guard_firm_taxonomy in 0024 — an INVOKER trigger that keys off current_user):
--   (1) INSERT: only the system may create kind='event' rows. The lead actions write events through
--       the service-role admin client (current_user = 'service_role'), so an ordinary authenticated
--       user can't fabricate fake lifecycle activity.
--   (2) UPDATE: a note's identity (author, kind, entity, firm) is immutable. Without this, a leads.edit
--       user could rewrite created_by_id to forge authorship, or flip a note into an event — and could
--       reassign ownership to dodge the author-or-admin delete rule. body / resolved_at / hidden_at
--       stay freely editable.
create or replace function public.guard_notes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'event' and current_user in ('authenticated', 'anon') then
      raise exception 'event notes are system-recorded, not user-created';
    end if;
    return new;
  end if;
  -- UPDATE: lock the row's identity.
  if new.created_by_id is distinct from old.created_by_id
     or new.kind is distinct from old.kind
     or new.entity_type is distinct from old.entity_type
     or new.entity_id is distinct from old.entity_id
     or new.firm_id is distinct from old.firm_id then
    raise exception 'cannot change a note''s identity (author, kind, entity, or firm)';
  end if;
  return new;
end;
$$;

create trigger notes_guard
  before insert or update on public.notes
  for each row execute function public.guard_notes();
