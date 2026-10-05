-- Shared demo deletion guard and storage cleanup for workspace deletion.
--
-- The demo credentials are published, so "owner may delete" lets any visitor
-- empty the showcase until the next scheduled reset. The guard is a
-- restrictive RLS policy, not just an RPC check: a console call to
-- supabase.from('structures').delete() hits the same wall. Dishes and
-- categories stay deletable so editing the demo menu still works.

create function public.is_protected_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.protected_accounts where user_id = (select auth.uid())::text)
$$;
revoke all on function public.is_protected_account() from public, anon;
grant execute on function public.is_protected_account() to authenticated;

create policy "structures_delete_unprotected" on public.structures as restrictive for delete to authenticated
  using (not (select public.is_protected_account()));
create policy "lists_delete_unprotected" on public.lists as restrictive for delete to authenticated
  using (not (select public.is_protected_account()));

-- Storage object paths (<uid>/<structure_id>/<file>) referenced anywhere in a document.
create function public.workspace_media_paths(doc jsonb, uid text)
returns setof text language sql immutable set search_path = '' as $$
  select distinct value #>> '{}'
  from pg_catalog.jsonb_path_query(coalesce(doc, 'null'::jsonb), 'strict $.**') value
  where pg_catalog.jsonb_typeof(value) = 'string' and pg_catalog.starts_with(value #>> '{}', uid || '/')
$$;
revoke all on function public.workspace_media_paths(jsonb, text) from public, anon;
grant execute on function public.workspace_media_paths(jsonb, text) to authenticated;

-- Of the candidate paths, those no remaining row of the caller still uses.
-- Duplicated menus share image paths with their source, so a path is only
-- safe to delete from Storage once nothing references it.
create function public.unreferenced_media_paths(candidates text[], uid text)
returns text[] language sql stable security invoker set search_path = '' as $$
  select coalesce(array_agg(path order by path), '{}') from unnest(candidates) path
  where not exists (select 1 from public.structures s where s.user_id = uid and strpos(s.structure::text, path) > 0)
    and not exists (select 1 from public.lists l where l.user_id = uid and strpos(l.data::text, path) > 0)
    and not exists (select 1 from public.categories c where c.user_id = uid and strpos(c.category::text, path) > 0)
    and not exists (select 1 from public.products p where p.user_id = uid and strpos(p.product::text, path) > 0)
$$;
revoke all on function public.unreferenced_media_paths(text[], text) from public, anon;
grant execute on function public.unreferenced_media_paths(text[], text) to authenticated;

-- The return type changes from void to text[], which create or replace cannot do.
drop function public.delete_restaurant_workspace(text);
drop function public.delete_menu_workspace(text);

-- Returns the Storage paths the client should now remove.
create function public.delete_menu_workspace(p_list_id text)
returns text[] language plpgsql security invoker set search_path = '' as $$
declare uid text := (select auth.uid())::text; paths text[]; doomed text[];
begin
  if (select public.is_protected_account()) then raise exception 'protected_account'; end if;
  perform 1 from public.lists where list_id = p_list_id and user_id = uid for update;
  if not found then raise exception 'not_owner'; end if;
  select coalesce(array_agg(product_id), '{}') into doomed from public.products where user_id = uid and category_id in (
    select category_id from public.categories where list_id = p_list_id and user_id = uid
    union
    select item->>'category_id' from public.categories c
    cross join lateral jsonb_array_elements(coalesce(c.category->'categories', '[]'::jsonb)) item
    where c.list_id = p_list_id and c.user_id = uid
  );
  select coalesce(array_agg(distinct path), '{}') into paths from (
    select public.workspace_media_paths(p.product, uid) path from public.products p
      where p.user_id = uid and p.product_id = any(doomed)
    union all
    select public.workspace_media_paths(c.category, uid) from public.categories c where c.list_id = p_list_id and c.user_id = uid
    union all
    select public.workspace_media_paths(l.data, uid) from public.lists l where l.list_id = p_list_id and l.user_id = uid
  ) found;
  delete from public.products where user_id = uid and product_id = any(doomed);
  delete from public.categories where list_id = p_list_id and user_id = uid;
  delete from public.lists where list_id = p_list_id and user_id = uid;
  return public.unreferenced_media_paths(paths, uid);
end;
$$;
revoke all on function public.delete_menu_workspace(text) from public, anon;
grant execute on function public.delete_menu_workspace(text) to authenticated;

create function public.delete_restaurant_workspace(p_structure_id text)
returns text[] language plpgsql security invoker set search_path = '' as $$
declare uid text := (select auth.uid())::text; menu_id text; paths text[];
begin
  if (select public.is_protected_account()) then raise exception 'protected_account'; end if;
  select coalesce(array_agg(path), '{}') into paths
    from public.structures s, public.workspace_media_paths(s.structure, uid) path
    where s.structure_id = p_structure_id and s.user_id = uid;
  perform 1 from public.structures where structure_id = p_structure_id and user_id = uid for update;
  if not found then raise exception 'not_owner'; end if;
  for menu_id in select list_id from public.lists where structure_id = p_structure_id and user_id = uid order by list_id loop
    paths := paths || public.delete_menu_workspace(menu_id);
  end loop;
  delete from public.structures where structure_id = p_structure_id and user_id = uid;
  return public.unreferenced_media_paths(paths, uid);
end;
$$;
revoke all on function public.delete_restaurant_workspace(text) from public, anon;
grant execute on function public.delete_restaurant_workspace(text) to authenticated;
