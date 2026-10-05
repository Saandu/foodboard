-- Fixes from the 2026-10-05 security audit (run-1, quick profile).
--
-- Every finding came from the same habit: a guard was written for the row in
-- hand and never for the rows it points at, the column nobody expected to be
-- written, or the account everyone shares. Each section names the finding it
-- closes.

------------------------------------------------------------------------------
-- 1. A child row must hang off a parent its own account owns.
--
-- The owner policies checked only the new row's user_id. A second account could
-- insert an active list under someone else's structure_id, a categories row
-- under someone else's list_id, or copy someone else's category_id into its own
-- category JSON and attach dishes to it. get_public_menu joined all of that by
-- id and published it under the victim's slug, and the foreign-key children
-- blocked the victim's own deletions and the demo reset.
------------------------------------------------------------------------------

-- Rows that could only have been planted that way. Deepest first.
delete from public.categories c
using public.lists l
where c.list_id = l.list_id and c.user_id <> l.user_id;
delete from public.categories c
using public.lists l, public.structures s
where c.list_id = l.list_id and l.structure_id = s.structure_id and l.user_id <> s.user_id;
delete from public.lists l
using public.structures s
where l.structure_id = s.structure_id and l.user_id <> s.user_id;

drop policy if exists "lists_insert_own" on public.lists;
drop policy if exists "lists_update_own" on public.lists;
create policy "lists_insert_own" on public.lists for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (select 1 from public.structures s where s.structure_id = lists.structure_id and s.user_id = (select auth.uid())::text)
  );
create policy "lists_update_own" on public.lists for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (select 1 from public.structures s where s.structure_id = lists.structure_id and s.user_id = (select auth.uid())::text)
  );

drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
create policy "categories_insert_own" on public.categories for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (select 1 from public.lists l where l.list_id = categories.list_id and l.user_id = (select auth.uid())::text)
  );
create policy "categories_update_own" on public.categories for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (select 1 from public.lists l where l.list_id = categories.list_id and l.user_id = (select auth.uid())::text)
  );

-- Category ids live inside JSON, so no key can make them unique. Products find
-- their category through check_product_category_owner, which only asks whether
-- the writer's own JSON lists the id — so the id must not already belong to
-- someone else. First writer wins; ids are client-side random UUIDs.
create index if not exists categories_category_path_idx on public.categories using gin (category jsonb_path_ops);

create or replace function public.check_category_ids_unclaimed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- security definer: RLS would hide exactly the rows this has to see.
  if exists (
    select 1
    from jsonb_path_query(coalesce(new.category, 'null'::jsonb), 'lax $.categories[*].category_id') id
    where exists (
      select 1 from public.categories c
      where c.user_id <> new.user_id
        and c.category @> jsonb_build_object('categories', jsonb_build_array(jsonb_build_object('category_id', id)))
    )
  ) then
    raise exception 'category_id_taken';
  end if;
  return new;
end;
$$;
revoke all on function public.check_category_ids_unclaimed() from public, anon, authenticated;
drop trigger if exists categories_check_ids_unclaimed on public.categories;
create trigger categories_check_ids_unclaimed before insert or update of category, user_id on public.categories
  for each row execute function public.check_category_ids_unclaimed();

-- The public menu publishes only rows owned by the structure's owner, so a
-- planted row is invisible even if one slipped past the checks above.
create or replace function public.get_public_menu(p_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
  with selected_structure as (select s.structure_id, s.user_id, s.title, s.structure from public.structures s where s.public_slug = p_slug),
  active_menu as (select l.list_id, l.title, l.user_id from public.lists l join selected_structure s on s.structure_id = l.structure_id and l.user_id = s.user_id where l.is_active is true order by l.list_id limit 1),
  visible_categories as (select category_item as category, l.user_id from public.categories c join active_menu l on l.list_id = c.list_id and c.user_id = l.user_id cross join lateral jsonb_array_elements(coalesce(c.category -> 'categories', '[]'::jsonb)) category_item where category_item ->> 'active' is distinct from 'false'),
  visible_products as (select p.category_id, coalesce(jsonb_agg(item) filter (where item ->> 'type' = 'divisor' or (item ->> 'active' is distinct from 'false' and item -> 'image' ->> 'active' is distinct from 'false')), '[]'::jsonb) as items from public.products p join visible_categories c on c.category ->> 'category_id' = p.category_id and p.user_id = c.user_id cross join lateral jsonb_array_elements(coalesce(p.product -> 'products', '[]'::jsonb)) item group by p.category_id)
  select case when exists (select 1 from active_menu) then jsonb_build_object('structure', (select jsonb_build_object('title', title, 'structure', structure) from selected_structure), 'list', (select jsonb_build_object('list_id', list_id, 'title', title) from active_menu), 'categories', coalesce((select jsonb_agg(category) from visible_categories), '[]'::jsonb), 'products', coalesce((select jsonb_object_agg(category_id, items) from visible_products), '{}'::jsonb)) else null end;
$$;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;

------------------------------------------------------------------------------
-- 2. Storage listing is owner-only.
--
-- structure_media_read let anon list every tenant's folders — account ids,
-- unpublished restaurants and feedback screenshots — and in a public bucket a
-- listed name is a readable URL. Public URLs do not consult RLS, so menus keep
-- rendering; the only client listing is the owner's own folder.
------------------------------------------------------------------------------
drop policy if exists "structure_media_read" on storage.objects;
create policy "structure_media_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'structure-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

------------------------------------------------------------------------------
-- 3 + 4. public_slug is issued, never chosen.
--
-- The column was writable by its owner, so a rotated (revoked) slug — the one
-- printed on the restaurant's QR codes — could be claimed by anyone else, and a
-- slug like '../index' reached the prerender as a file path.
------------------------------------------------------------------------------
revoke insert, update on table public.structures from authenticated;
grant insert (structure_id, user_id, title, structure) on table public.structures to authenticated;
grant update (structure_id, user_id, title, structure) on table public.structures to authenticated;

-- not valid: enforced on every new write without failing on an old row.
alter table public.structures drop constraint if exists structures_public_slug_format;
alter table public.structures add constraint structures_public_slug_format
  check (public_slug ~ '^[a-z0-9-]{1,64}$') not valid;

-- Rotation is now the only way to change a slug, so it needs the column
-- privilege the caller no longer has. Ownership is checked here instead of by RLS.
create or replace function public.rotate_public_slug(p_structure_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  new_slug text;
begin
  new_slug := public.generate_public_slug();
  update public.structures set public_slug = new_slug
  where structure_id = p_structure_id and user_id = (select auth.uid())::text;
  if not found then
    raise exception 'structure not found or not yours';
  end if;
  return new_slug;
end;
$$;
revoke all on function public.rotate_public_slug(text) from public, anon;
grant execute on function public.rotate_public_slug(text) to authenticated;

------------------------------------------------------------------------------
-- 5. Deleting an account no longer refunds the Gemini budget.
--
-- Attempt rows cascaded away with their auth user, and every limit in
-- reserve_menu_import counts surviving rows, so sign-up/extract/delete loops
-- reset the project-wide daily cap. The rows hold no personal data beyond the
-- id and are pruned after two days anyway.
------------------------------------------------------------------------------
alter table public.menu_import_attempts drop constraint if exists menu_import_attempts_user_id_fkey;

------------------------------------------------------------------------------
-- 6. The shared demo cannot delete or overwrite its stored images.
--
-- The reset restores image paths, not image bytes, so a removed or replaced
-- object stayed broken across every reset. Uploading new images still works.
------------------------------------------------------------------------------
drop policy if exists "structure_media_update_own" on storage.objects;
drop policy if exists "structure_media_delete_own" on storage.objects;
create policy "structure_media_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'structure-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select public.is_protected_account())
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
    and not (select public.is_protected_account())
  );

------------------------------------------------------------------------------
-- 7. The shared demo's credentials cannot be changed.
--
-- Its password is published, so any visitor could set a new one and lock
-- everyone else out; the reset only rebuilds public tables. GoTrue writes
-- auth.users itself, so the guard sits on the table. To change the demo's
-- credentials deliberately, run `set foodboard.allow_protected_credential_change
-- = 'on'` in the same SQL session, or remove its protected_accounts row first
-- (the next reset puts it back).
------------------------------------------------------------------------------
create or replace function public.guard_protected_credentials()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.encrypted_password is distinct from old.encrypted_password
      or new.email is distinct from old.email
      or new.phone is distinct from old.phone
      or coalesce(new.email_change, '') is distinct from coalesce(old.email_change, '')
      or coalesce(new.phone_change, '') is distinct from coalesce(old.phone_change, ''))
     and exists (select 1 from public.protected_accounts where user_id = old.id::text)
     and coalesce(current_setting('foodboard.allow_protected_credential_change', true), '') <> 'on'
  then
    raise exception 'account is protected: its credentials cannot be changed'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_protected_credentials() from public, anon, authenticated;
drop trigger if exists on_auth_user_credentials_change on auth.users;
create trigger on_auth_user_credentials_change
  before update on auth.users
  for each row execute procedure public.guard_protected_credentials();

------------------------------------------------------------------------------
-- 8. The showcase reset clears anything squatting its fixed ids.
--
-- The demo may delete its own dishes and categories, which frees fixed ids
-- such as '11111'; another account could then take one, and every later reset
-- failed on the primary key and rolled back. The reset now removes foreign rows
-- holding a showcase id, or hanging off a showcase parent, before it rebuilds.
------------------------------------------------------------------------------
create or replace function public.reset_showcase(
  p_showcase_user_id text,
  p_users jsonb,
  p_structures jsonb,
  p_lists jsonb,
  p_categories jsonb,
  p_products jsonb,
  p_protect boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  structure_ids text[];
  list_ids text[];
  category_row_ids text[];
  product_ids text[];
  slugs text[];
  json_category_ids jsonb[];
begin
  if nullif(trim(p_showcase_user_id), '') is null then
    raise exception 'showcase user id is required';
  end if;

  if jsonb_typeof(coalesce(p_users, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_structures, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_lists, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_categories, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_products, '[]'::jsonb)) <> 'array' then
    raise exception 'showcase payloads must be JSON arrays';
  end if;

  if exists (
    select 1
    from (
      select value from jsonb_array_elements(coalesce(p_users, '[]'::jsonb))
      union all
      select value from jsonb_array_elements(coalesce(p_structures, '[]'::jsonb))
      union all
      select value from jsonb_array_elements(coalesce(p_lists, '[]'::jsonb))
      union all
      select value from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb))
      union all
      select value from jsonb_array_elements(coalesce(p_products, '[]'::jsonb))
    ) payload
    where payload.value ->> 'user_id' is distinct from p_showcase_user_id
  ) then
    raise exception 'showcase payload contains rows owned by another account';
  end if;

  structure_ids := array(select value ->> 'structure_id' from jsonb_array_elements(coalesce(p_structures, '[]'::jsonb)));
  slugs := array(select value ->> 'public_slug' from jsonb_array_elements(coalesce(p_structures, '[]'::jsonb)) where value ? 'public_slug');
  list_ids := array(select value ->> 'list_id' from jsonb_array_elements(coalesce(p_lists, '[]'::jsonb)));
  category_row_ids := array(select value ->> 'category_id' from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)));
  product_ids := array(select value ->> 'product_id' from jsonb_array_elements(coalesce(p_products, '[]'::jsonb)));
  json_category_ids := array(
    select id
    from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) category_row,
         jsonb_path_query(category_row.value -> 'category', 'lax $.categories[*].category_id') id
  );

  -- Foreign rows in the way, deepest first. Only an account squatting a
  -- showcase id or hanging rows off a showcase parent can own one of these.
  delete from public.products
  where user_id <> p_showcase_user_id and product_id = any(product_ids);
  delete from public.categories c
  where c.user_id <> p_showcase_user_id
    and (
      c.category_id = any(category_row_ids)
      or c.list_id = any(list_ids)
      or c.list_id in (select l.list_id from public.lists l where l.user_id <> p_showcase_user_id and l.structure_id = any(structure_ids))
      or exists (
        select 1 from unnest(json_category_ids) id
        where c.category @> jsonb_build_object('categories', jsonb_build_array(jsonb_build_object('category_id', id)))
      )
    );
  delete from public.lists
  where user_id <> p_showcase_user_id and (list_id = any(list_ids) or structure_id = any(structure_ids));
  update public.structures set public_slug = public.generate_public_slug()
  where user_id <> p_showcase_user_id and public_slug = any(slugs);

  -- Deepest children first keeps foreign-key checks explicit and readable.
  delete from public.products where user_id = p_showcase_user_id;
  delete from public.categories where user_id = p_showcase_user_id;
  delete from public.lists where user_id = p_showcase_user_id;
  delete from public.structures where user_id = p_showcase_user_id;

  -- A real Auth account owns its profile row, so production resets send an
  -- empty users payload. Placeholder-only databases may replace that row.
  if jsonb_array_length(coalesce(p_users, '[]'::jsonb)) > 0 then
    delete from public.users where user_id = p_showcase_user_id;

    insert into public.users (user_id, name, surname, settings, notifications)
    select user_id, name, surname, settings, notifications
    from jsonb_to_recordset(p_users) as row(
      user_id text,
      name text,
      surname text,
      settings jsonb,
      notifications jsonb
    );
  end if;

  insert into public.structures (structure_id, user_id, public_slug, title, structure)
  select structure_id, user_id, public_slug, title, structure
  from jsonb_to_recordset(coalesce(p_structures, '[]'::jsonb)) as row(
    structure_id text,
    user_id text,
    public_slug text,
    title text,
    structure jsonb
  );

  insert into public.lists (list_id, structure_id, user_id, title, is_active, has_sublists, data)
  select list_id, structure_id, user_id, title, is_active, has_sublists, data
  from jsonb_to_recordset(coalesce(p_lists, '[]'::jsonb)) as row(
    list_id text,
    structure_id text,
    user_id text,
    title text,
    is_active boolean,
    has_sublists boolean,
    data jsonb
  );

  insert into public.categories (category_id, list_id, user_id, category)
  select category_id, list_id, user_id, category
  from jsonb_to_recordset(coalesce(p_categories, '[]'::jsonb)) as row(
    category_id text,
    list_id text,
    user_id text,
    category jsonb
  );

  insert into public.products (product_id, category_id, user_id, product)
  select product_id, category_id, user_id, product
  from jsonb_to_recordset(coalesce(p_products, '[]'::jsonb)) as row(
    product_id text,
    category_id text,
    user_id text,
    product jsonb
  );

  if p_protect then
    insert into public.protected_accounts (user_id, reason)
    values (
      p_showcase_user_id,
      'shared demo account: credentials are published in the README'
    )
    on conflict (user_id) do update set reason = excluded.reason;
  end if;

  result := jsonb_build_object(
    'users', jsonb_array_length(coalesce(p_users, '[]'::jsonb)),
    'structures', jsonb_array_length(coalesce(p_structures, '[]'::jsonb)),
    'lists', jsonb_array_length(coalesce(p_lists, '[]'::jsonb)),
    'categories', jsonb_array_length(coalesce(p_categories, '[]'::jsonb)),
    'products', jsonb_array_length(coalesce(p_products, '[]'::jsonb))
  );

  return result;
end;
$$;

comment on function public.reset_showcase(text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean) is
  'Atomically replaces every row belonging to the configured shared showcase account, clearing foreign rows that squat its fixed ids.';

revoke all on function public.reset_showcase(text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.reset_showcase(text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean)
  to service_role;
