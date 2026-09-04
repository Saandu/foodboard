-- Publish menus under a rotatable slug instead of the primary key.
--
-- get_public_menu used to take structures.structure_id, which meant the public
-- address of a menu was its primary key: it could not be changed, and the
-- seeded demo ids ('111', '222') were trivially guessable. Each structure now
-- carries a random public_slug that the owner can rotate to revoke a link that
-- has leaked.
--
-- Breaking: /menu/<structure_id> no longer resolves. Callers must pass the
-- slug. That is the point — if the id kept working, rotating would revoke
-- nothing.

-- gen_random_uuid() is core in Postgres 13+, so this needs no extension.
create or replace function public.generate_public_slug()
returns text language sql volatile set search_path = '' as $$
  select left(replace(gen_random_uuid()::text, '-', ''), 22);
$$;
revoke all on function public.generate_public_slug() from public, anon;
-- Column defaults run as the inserting role, so authenticated needs execute.
grant execute on function public.generate_public_slug() to authenticated, service_role;

alter table public.structures add column if not exists public_slug text;
update public.structures set public_slug = public.generate_public_slug() where public_slug is null;
alter table public.structures alter column public_slug set default public.generate_public_slug();
alter table public.structures alter column public_slug set not null;
create unique index if not exists structures_public_slug_key on public.structures (public_slug);

-- Issues a fresh slug for a structure you own. security invoker on purpose:
-- the structures RLS policy is what stops one account rotating another's link.
create or replace function public.rotate_public_slug(p_structure_id text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  new_slug text;
begin
  new_slug := public.generate_public_slug();
  update public.structures set public_slug = new_slug where structure_id = p_structure_id;
  if not found then
    raise exception 'structure not found or not yours';
  end if;
  return new_slug;
end;
$$;
revoke all on function public.rotate_public_slug(text) from public, anon;
grant execute on function public.rotate_public_slug(text) to authenticated;

-- The parameter is renamed, which CREATE OR REPLACE cannot do.
drop function if exists public.get_public_menu(text);

create or replace function public.get_public_menu(p_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
  with selected_structure as (select s.structure_id, s.title, s.structure from public.structures s where s.public_slug = p_slug),
  active_menu as (select l.list_id, l.title from public.lists l join selected_structure s on s.structure_id = l.structure_id where l.is_active is true order by l.list_id limit 1),
  visible_categories as (select category_item as category from public.categories c join active_menu l on l.list_id = c.list_id cross join lateral jsonb_array_elements(coalesce(c.category -> 'categories', '[]'::jsonb)) category_item where category_item ->> 'active' is distinct from 'false'),
  visible_products as (select p.category_id, coalesce(jsonb_agg(item) filter (where item ->> 'type' = 'divisor' or (item ->> 'active' is distinct from 'false' and item -> 'image' ->> 'active' is distinct from 'false')), '[]'::jsonb) as items from public.products p join visible_categories c on c.category ->> 'category_id' = p.category_id cross join lateral jsonb_array_elements(coalesce(p.product -> 'products', '[]'::jsonb)) item group by p.category_id)
  select case when exists (select 1 from active_menu) then jsonb_build_object('structure', (select jsonb_build_object('title', title, 'structure', structure) from selected_structure), 'list', (select jsonb_build_object('list_id', list_id, 'title', title) from active_menu), 'categories', coalesce((select jsonb_agg(category) from visible_categories), '[]'::jsonb), 'products', coalesce((select jsonb_object_agg(category_id, items) from visible_products), '{}'::jsonb)) else null end;
$$;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;
