-- Protect note "by" attribution on update (review feedback on #27). The 0029 guard already freezes a
-- note's identity (author / kind / entity / firm); this extends guard_notes so resolved_by_id and
-- hidden_by_id track their timestamps and belong to the acting user: they may change ONLY in lockstep
-- with resolved_at / hidden_at, and only to the caller (when set) or null (when cleared).
--
-- This needs OLD-vs-NEW comparison, so it lives in the trigger, not an RLS WITH CHECK (which sees only
-- the new row — that would both BLOCK a user from editing a note someone else resolved and still LET
-- them steal attribution). notes_update stays exactly as 0029 defined it.
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
  -- UPDATE: identity is immutable.
  if new.created_by_id is distinct from old.created_by_id
     or new.kind is distinct from old.kind
     or new.entity_type is distinct from old.entity_type
     or new.entity_id is distinct from old.entity_id
     or new.firm_id is distinct from old.firm_id then
    raise exception 'cannot change a note''s identity (author, kind, entity, or firm)';
  end if;
  -- Attribution moves only with its timestamp, and only to the caller. Enforced for end users; the
  -- system/admin client (service_role) never updates these columns.
  if current_user in ('authenticated', 'anon') then
    if new.resolved_at is distinct from old.resolved_at then
      if new.resolved_by_id is distinct from
         (case when new.resolved_at is null then null else (select auth.uid()) end) then
        raise exception 'resolved_by_id must be the acting user (or null when reopening)';
      end if;
    elsif new.resolved_by_id is distinct from old.resolved_by_id then
      raise exception 'cannot change resolved_by_id without changing resolved_at';
    end if;
    if new.hidden_at is distinct from old.hidden_at then
      if new.hidden_by_id is distinct from
         (case when new.hidden_at is null then null else (select auth.uid()) end) then
        raise exception 'hidden_by_id must be the acting user (or null when unhiding)';
      end if;
    elsif new.hidden_by_id is distinct from old.hidden_by_id then
      raise exception 'cannot change hidden_by_id without changing hidden_at';
    end if;
  end if;
  return new;
end;
$$;
