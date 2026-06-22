-- Protect note "by" attribution (review feedback on #27). The 0029 guard freezes a note's identity
-- (author / kind / entity / firm); this extends guard_notes so resolved_by_id / hidden_by_id can only
-- move in lockstep with their timestamp, only to the acting user, and only on a null<->set transition
-- (never set->set, which would let a user re-attribute an already-resolved/hidden note to themselves).
-- A user-created note also can't OPEN already attributed to someone else. All enforced for end users;
-- the system/admin client (service_role) is exempt. OLD-vs-NEW logic lives in the trigger, not an RLS
-- WITH CHECK (which sees only the new row). System events stay immutable to end users via the
-- notes_update / notes_delete policies, which already scope to kind = 'note'.
create or replace function public.guard_notes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      if new.kind = 'event' then
        raise exception 'event notes are system-recorded, not user-created';
      end if;
      if (new.resolved_by_id is not null and new.resolved_by_id is distinct from (select auth.uid()))
         or (new.hidden_by_id is not null and new.hidden_by_id is distinct from (select auth.uid())) then
        raise exception 'cannot attribute a note action to another user';
      end if;
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
  if current_user in ('authenticated', 'anon') then
    if new.resolved_at is distinct from old.resolved_at then
      if old.resolved_at is not null and new.resolved_at is not null then
        raise exception 'reopen a note before resolving it again';
      end if;
      if new.resolved_by_id is distinct from
         (case when new.resolved_at is null then null else (select auth.uid()) end) then
        raise exception 'resolved_by_id must be the acting user (or null when reopening)';
      end if;
    elsif new.resolved_by_id is distinct from old.resolved_by_id then
      raise exception 'cannot change resolved_by_id without changing resolved_at';
    end if;
    if new.hidden_at is distinct from old.hidden_at then
      if old.hidden_at is not null and new.hidden_at is not null then
        raise exception 'unhide a note before hiding it again';
      end if;
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
