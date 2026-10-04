-- Atomic, caller-scoped deletion. Existing RLS remains active in both RPCs.
create function public.delete_menu_workspace(p_list_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare uid text := (select auth.uid())::text;
begin
  perform 1 from public.lists where list_id = p_list_id and user_id = uid for update;
  if not found then raise exception 'not_owner'; end if;
  delete from public.products where user_id = uid and category_id in (
    select category_id from public.categories where list_id = p_list_id and user_id = uid
    union
    select item->>'category_id' from public.categories c
    cross join lateral jsonb_array_elements(coalesce(c.category->'categories', '[]'::jsonb)) item
    where c.list_id = p_list_id and c.user_id = uid
  );
  delete from public.categories where list_id = p_list_id and user_id = uid;
  delete from public.lists where list_id = p_list_id and user_id = uid;
end;
$$;
revoke all on function public.delete_menu_workspace(text) from public, anon;
grant execute on function public.delete_menu_workspace(text) to authenticated;

create function public.delete_restaurant_workspace(p_structure_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare uid text := (select auth.uid())::text; menu_id text;
begin
  perform 1 from public.structures where structure_id = p_structure_id and user_id = uid for update;
  if not found then raise exception 'not_owner'; end if;
  for menu_id in select list_id from public.lists where structure_id = p_structure_id and user_id = uid order by list_id loop
    perform public.delete_menu_workspace(menu_id);
  end loop;
  delete from public.structures where structure_id = p_structure_id and user_id = uid;
end;
$$;
revoke all on function public.delete_restaurant_workspace(text) from public, anon;
grant execute on function public.delete_restaurant_workspace(text) to authenticated;
