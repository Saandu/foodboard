-- The public menu translated its categories and dishes but not the menu's own
-- name: get_public_menu returned only lists.title, a plain column that always
-- holds the main-language value. The per-language names live in the list's
-- editModal descriptor, so expose that alongside the title and let the client
-- resolve it the same way it resolves category and dish names.

create or replace function public.get_public_menu(p_structure_id text) returns jsonb language sql stable security definer set search_path = '' as $$
  with selected_structure as (
    select s.structure_id, s.title, s.structure
    from public.structures s
    where s.structure_id = p_structure_id
  ),
  active_menu as (
    select l.list_id, l.title, coalesce(l.data -> 'editModal', '[]'::jsonb) as edit_modal
    from public.lists l
    join selected_structure s on s.structure_id = l.structure_id
    where l.is_active is true
    order by l.list_id
    limit 1
  ),
  visible_categories as (
    select category_item as category
    from public.categories c
    join active_menu l on l.list_id = c.list_id
    cross join lateral jsonb_array_elements(coalesce(c.category -> 'categories', '[]'::jsonb)) category_item
    where category_item ->> 'active' is distinct from 'false'
  ),
  visible_products as (
    select p.category_id,
           coalesce(
             jsonb_agg(item) filter (
               where item ->> 'type' = 'divisor'
                  or (item ->> 'active' is distinct from 'false'
                      and item -> 'image' ->> 'active' is distinct from 'false')
             ),
             '[]'::jsonb
           ) as items
    from public.products p
    join visible_categories c on c.category ->> 'category_id' = p.category_id
    cross join lateral jsonb_array_elements(coalesce(p.product -> 'products', '[]'::jsonb)) item
    group by p.category_id
  )
  select case when exists (select 1 from active_menu) then jsonb_build_object(
    'structure', (select jsonb_build_object('title', title, 'structure', structure) from selected_structure),
    'list', (select jsonb_build_object('list_id', list_id, 'title', title, 'editModal', edit_modal) from active_menu),
    'categories', coalesce((select jsonb_agg(category) from visible_categories), '[]'::jsonb),
    'products', coalesce((select jsonb_object_agg(category_id, items) from visible_products), '{}'::jsonb)
  ) else null end;
$$;

revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;
