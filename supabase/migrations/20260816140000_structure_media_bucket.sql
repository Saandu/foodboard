-- Storage for structure logos and backdrops.
--
-- These used to be base64 data URLs inside structures.structure, so every
-- dashboard read pulled the full image down and a large upload could push the
-- row past Postgres limits. Images now live in a public bucket and the JSONB
-- holds only the object path.
--
-- Layout: <auth uid>/<structure_id>/<field>-<timestamp>.<ext>
-- The first path segment is the owner, which is what the write policies below
-- check. Reads are open: a published menu has to render for anonymous diners.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'structure-media',
  'structure-media',
  true,
  5242880, -- 5 MB; the editor rejects anything larger before it uploads
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "structure_media_read" on storage.objects;
drop policy if exists "structure_media_insert_own" on storage.objects;
drop policy if exists "structure_media_update_own" on storage.objects;
drop policy if exists "structure_media_delete_own" on storage.objects;

-- A public bucket already serves /object/public/... without consulting RLS;
-- this policy is what lets the client read the object row back after a write.
create policy "structure_media_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'structure-media');

create policy "structure_media_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'structure-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "structure_media_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'structure-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'structure-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "structure_media_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'structure-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
