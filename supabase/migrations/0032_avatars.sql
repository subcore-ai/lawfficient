-- Profile avatars: a public Storage bucket + a pointer column on profiles.
--
-- Avatars are low-sensitivity staff headshots, so the bucket is public-read
-- (stable CDN URLs, no per-request signing); writes are RLS-locked to each
-- user's own {uid}/… folder. profiles.avatar_path stores the object path and the
-- public URL is derived at render time (storage.getPublicUrl).

alter table public.profiles add column avatar_path text;

-- Public bucket with hard limits enforced at the storage layer (defense in depth
-- with the server action's own validation): 4 MB, common web image types only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by Supabase. Reads are served by the
-- public object endpoint (the bucket is public), so only writes need policies —
-- each scoped to the caller's own top-level folder, i.e. {uid}/<file>. The
-- server action uploads a fresh filename and removes the old object, so INSERT +
-- DELETE are the only operations used (no upsert → no UPDATE/SELECT policy).
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
