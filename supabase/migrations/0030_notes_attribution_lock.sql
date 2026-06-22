-- Lock note "by" attribution on update (review feedback on #27). guard_notes (0029) freezes a note's
-- identity (author / kind / entity / firm); this stops a leads.edit user from forging WHO addressed or
-- hid a note. resolved_by_id / hidden_by_id, when set, must equal the caller (auth.uid()) — the server
-- actions already set them to the actor, so the legit path is unaffected; only a hand-crafted update
-- pointing them at another profile is rejected.
drop policy "notes_update" on public.notes;

create policy "notes_update" on public.notes
  for update to authenticated
  using (
    firm_id = public.current_firm_id()
    and public.authorize('leads.edit')
    and kind = 'note'
  )
  with check (
    firm_id = public.current_firm_id()
    and public.authorize('leads.edit')
    and kind = 'note'
    and (resolved_by_id is null or resolved_by_id = (select auth.uid()))
    and (hidden_by_id is null or hidden_by_id = (select auth.uid()))
  );
