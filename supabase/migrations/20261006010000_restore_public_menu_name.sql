-- Restore the menu's per-language name on the public menu.
--
-- 20260816120000 added list.editModal so CustomerMenu could translate the
-- menu's own name, but 20260816150000 recreated get_public_menu from the older
-- body and dropped it again; every language view has shown the main-language
-- title since. Same body as 20261006000000 (owner-only joins) plus editModal.

create or replace function public.get_public_menu(p_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
  with selected_structure as (select s.structure_id, s.user_id, s.title, s.structure from public.structures s where s.public_slug = p_slug),
  active_menu as (select l.list_id, l.title, l.user_id, coalesce(l.data -> 'editModal', '[]'::jsonb) as edit_modal from public.lists l join selected_structure s on s.structure_id = l.structure_id and l.user_id = s.user_id where l.is_active is true order by l.list_id limit 1),
  visible_categories as (select category_item as category, l.user_id from public.categories c join active_menu l on l.list_id = c.list_id and c.user_id = l.user_id cross join lateral jsonb_array_elements(coalesce(c.category -> 'categories', '[]'::jsonb)) category_item where category_item ->> 'active' is distinct from 'false'),
  visible_products as (select p.category_id, coalesce(jsonb_agg(item) filter (where item ->> 'type' = 'divisor' or (item ->> 'active' is distinct from 'false' and item -> 'image' ->> 'active' is distinct from 'false')), '[]'::jsonb) as items from public.products p join visible_categories c on c.category ->> 'category_id' = p.category_id and p.user_id = c.user_id cross join lateral jsonb_array_elements(coalesce(p.product -> 'products', '[]'::jsonb)) item group by p.category_id)
  select case when exists (select 1 from active_menu) then jsonb_build_object('structure', (select jsonb_build_object('title', title, 'structure', structure) from selected_structure), 'list', (select jsonb_build_object('list_id', list_id, 'title', title, 'editModal', edit_modal) from active_menu), 'categories', coalesce((select jsonb_agg(category) from visible_categories), '[]'::jsonb), 'products', coalesce((select jsonb_object_agg(category_id, items) from visible_products), '{}'::jsonb)) else null end;
$$;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;
