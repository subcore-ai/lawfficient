-- Self-service office hours (spec 13). A schedulable user edits their OWN availability from their
-- profile page; admins (settings.manage) still manage anyone's. Extend the 0040 policies so the owner
-- is allowed alongside settings.manage. The set_attorney_availability RPC is SECURITY INVOKER, so it
-- inherits these policies — an owner can replace their own week, and a non-admin calling it for someone
-- else has its delete/insert rejected.
--
-- Owner WRITES additionally require profiles.schedulable: who takes consultations is admin-controlled
-- (see the 0040 self-escalation guard), so a non-schedulable user must not be able to seed their own
-- availability rows directly through the Data API, bypassing the action's check. Reads allow plain self
-- so a schedulable user without consultations.view can still load their own hours.

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
    and (
      public.authorize('settings.manage')
      or (
        attorney_id = (select auth.uid())
        and (select schedulable from public.profiles where id = (select auth.uid()))
      )
    )
  );

drop policy if exists "attorney_availability_update" on public.attorney_availability;
create policy "attorney_availability_update" on public.attorney_availability
  for update to authenticated
  using (
    firm_id = public.current_firm_id()
    and (
      public.authorize('settings.manage')
      or (
        attorney_id = (select auth.uid())
        and (select schedulable from public.profiles where id = (select auth.uid()))
      )
    )
  )
  with check (
    firm_id = public.current_firm_id()
    and (
      public.authorize('settings.manage')
      or (
        attorney_id = (select auth.uid())
        and (select schedulable from public.profiles where id = (select auth.uid()))
      )
    )
  );

drop policy if exists "attorney_availability_delete" on public.attorney_availability;
create policy "attorney_availability_delete" on public.attorney_availability
  for delete to authenticated
  using (
    firm_id = public.current_firm_id()
    and (
      public.authorize('settings.manage')
      or (
        attorney_id = (select auth.uid())
        and (select schedulable from public.profiles where id = (select auth.uid()))
      )
    )
  );
