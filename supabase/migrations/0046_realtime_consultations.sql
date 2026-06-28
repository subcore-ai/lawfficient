-- Realtime on consultations: the calendar subscribes via Postgres Changes so bookings / reschedules /
-- cancels show live across the firm. RLS already scopes consultations to the firm (0013 + the per-command
-- policies) and Postgres Changes respects RLS, so a subscriber only ever receives its own firm's changes.
-- Idempotent: skip if the table is already in the publication (re-runnable on a fresh db reset).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'consultations'
  ) then
    alter publication supabase_realtime add table public.consultations;
  end if;
end $$;
