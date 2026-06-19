-- Local dev seed (applied by `supabase db reset`).
-- Creates the firm and its default packet pipeline so a bootstrap admin user
-- has a firm_id to attach to. The fixed UUID below is what you pass as
-- app_metadata.firm_id when creating the first admin user (see supabase/README.md).
insert into public.firms (id, name)
values ('00000000-0000-0000-0000-000000000001', 'The Chidolue Law Firm')
on conflict (id) do nothing;

insert into public.packet_stages (firm_id, name, sla_days, position) values
  ('00000000-0000-0000-0000-000000000001', 'Document gathering & prep', 5, 0),
  ('00000000-0000-0000-0000-000000000001', 'First QA review', 2, 1),
  ('00000000-0000-0000-0000-000000000001', 'Corrections by LA', 2, 2),
  ('00000000-0000-0000-0000-000000000001', 'Document-review attorney', 3, 3),
  ('00000000-0000-0000-0000-000000000001', 'Corrections by LA', 2, 4),
  ('00000000-0000-0000-0000-000000000001', 'Office attorney review', 3, 5),
  ('00000000-0000-0000-0000-000000000001', 'Client review', 3, 6),
  ('00000000-0000-0000-0000-000000000001', 'Correction by LA', 2, 7),
  ('00000000-0000-0000-0000-000000000001', 'Final attorney review', 2, 8),
  ('00000000-0000-0000-0000-000000000001', 'Packet mailed', 1, 9)
on conflict do nothing;
