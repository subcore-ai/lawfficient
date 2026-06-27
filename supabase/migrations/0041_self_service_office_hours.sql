-- Self-service office hours (spec 13). A schedulable user edits their OWN availability from their
-- profile page; admins (settings.manage) still manage anyone's. Extend the 0040 policies so the owner
-- (attorney_id = the caller's uid) is allowed alongside settings.manage. The set_attorney_availability
-- RPC is SECURITY INVOKER, so it inherits these policies — an owner can replace their own week, and a
-- non-admin calling it for someone else has its insert rejected by the WITH CHECK.

-- Read also allows self: a schedulable user without consultations.view must still load their own hours,
-- or the editor would render empty and a save would wipe them.
drop policy if exists "attorney_availability_select" on public.attorney_availability;
create policy "attorney_availability_select" on public.attorney_availability
  for select to authenticated
  using (
    firm_id = public.current_firm_id()
    and (
      public.authorize('consultations.view')
      or public.authorize('settings.manage')
      or attorney_id = (select auth.uid())
    )
  );

drop policy if exists "attorney_availability_insert" on public.attorney_availability;
create policy "attorney_availability_insert" on public.attorney_availability
  for insert to authenticated
  with check (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or attorney_id = (select auth.uid()))
  );

drop policy if exists "attorney_availability_update" on public.attorney_availability;
create policy "attorney_availability_update" on public.attorney_availability
  for update to authenticated
  using (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or attorney_id = (select auth.uid()))
  )
  with check (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or attorney_id = (select auth.uid()))
  );

drop policy if exists "attorney_availability_delete" on public.attorney_availability;
create policy "attorney_availability_delete" on public.attorney_availability
  for delete to authenticated
  using (
    firm_id = public.current_firm_id()
    and (public.authorize('settings.manage') or attorney_id = (select auth.uid()))
  );
