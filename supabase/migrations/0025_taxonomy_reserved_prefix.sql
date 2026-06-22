-- Enforce the reserved "__" label prefix at the DB level. The settings actions already reject it,
-- but a direct Supabase API / rename_firm_taxonomy RPC call by a settings.manage user could
-- otherwise set a label to __none__ / __add__ — the lead-form sentinels — breaking TaxonomySelect
-- and the hidden-field mapping. A table CHECK covers every write path (insert + the RPC's update).
-- left(label, 2) avoids LIKE wildcard escaping ('_' is a LIKE wildcard); seeded labels never match.
alter table public.firm_taxonomies
  add constraint firm_taxonomies_label_not_reserved check (left(label, 2) <> '__');
