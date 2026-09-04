-- Auth-owned dashboard data and a deliberately narrow public-menu function.
alter table public.lists add column if not exists user_id text;
alter table public.categories add column if not exists user_id text;
alter table public.products add column if not exists user_id text;
update public.lists l set user_id = s.user_id from public.structures s where l.structure_id = s.structure_id and l.user_id is null;
update public.categories c set user_id = l.user_id from public.lists l where c.list_id = l.list_id and c.user_id is null;
update public.products p set user_id = s.user_id from public.categories c join public.lists l on l.list_id = c.list_id join public.structures s on s.structure_id = l.structure_id where p.user_id is null and exists (select 1 from jsonb_array_elements(coalesce(c.category -> 'categories', '[]'::jsonb)) item where item ->> 'category_id' = p.category_id);
alter table public.lists alter column user_id set not null;
alter table public.categories alter column user_id set not null;
alter table public.products alter column user_id set not null;
create index if not exists structures_user_id_idx on public.structures (user_id);
create index if not exists lists_user_id_idx on public.lists (user_id);
create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists products_user_id_idx on public.products (user_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (user_id, name, surname, settings, notifications)
  values (new.id::text, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), '', '{}'::jsonb, '[]'::jsonb)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;
-- rls_auto_enable is a helper this project happened to have; a fresh database
-- will not, and an unguarded revoke would abort the whole migration.
do $$ begin
  execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
exception when undefined_function then null;
end $$;

do $$ declare item record; begin
  for item in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('users','structures','lists','categories','products') loop
    execute format('drop policy if exists %I on public.%I', item.policyname, item.tablename);
  end loop;
end $$;
revoke all on table public.users, public.structures, public.lists, public.categories, public.products from anon;
grant select, insert, update, delete on table public.users, public.structures, public.lists, public.categories, public.products to authenticated;
alter table public.users enable row level security;
alter table public.structures enable row level security;
alter table public.lists enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;

create policy "users_select_own" on public.users for select to authenticated using ((select auth.uid())::text = user_id);
create policy "users_insert_own" on public.users for insert to authenticated with check ((select auth.uid())::text = user_id);
create policy "users_update_own" on public.users for update to authenticated using ((select auth.uid())::text = user_id) with check ((select auth.uid())::text = user_id);

create policy "structures_select_own" on public.structures for select to authenticated using ((select auth.uid())::text = user_id);
create policy "structures_insert_own" on public.structures for insert to authenticated with check ((select auth.uid())::text = user_id);
create policy "structures_update_own" on public.structures for update to authenticated using ((select auth.uid())::text = user_id) with check ((select auth.uid())::text = user_id);
create policy "structures_delete_own" on public.structures for delete to authenticated using ((select auth.uid())::text = user_id);

create policy "lists_select_own" on public.lists for select to authenticated using ((select auth.uid())::text = user_id);
create policy "lists_insert_own" on public.lists for insert to authenticated with check ((select auth.uid())::text = user_id);
create policy "lists_update_own" on public.lists for update to authenticated using ((select auth.uid())::text = user_id) with check ((select auth.uid())::text = user_id);
create policy "lists_delete_own" on public.lists for delete to authenticated using ((select auth.uid())::text = user_id);

create policy "categories_select_own" on public.categories for select to authenticated using ((select auth.uid())::text = user_id);
create policy "categories_insert_own" on public.categories for insert to authenticated with check ((select auth.uid())::text = user_id);
create policy "categories_update_own" on public.categories for update to authenticated using ((select auth.uid())::text = user_id) with check ((select auth.uid())::text = user_id);
create policy "categories_delete_own" on public.categories for delete to authenticated using ((select auth.uid())::text = user_id);

create policy "products_select_own" on public.products for select to authenticated using ((select auth.uid())::text = user_id);
create policy "products_insert_own" on public.products for insert to authenticated with check ((select auth.uid())::text = user_id);
create policy "products_update_own" on public.products for update to authenticated using ((select auth.uid())::text = user_id) with check ((select auth.uid())::text = user_id);
create policy "products_delete_own" on public.products for delete to authenticated using ((select auth.uid())::text = user_id);

create or replace function public.get_public_menu(p_structure_id text) returns jsonb language sql stable security definer set search_path = '' as $$
  with selected_structure as (select s.structure_id, s.title, s.structure from public.structures s where s.structure_id = p_structure_id),
  active_menu as (select l.list_id, l.title from public.lists l join selected_structure s on s.structure_id = l.structure_id where l.is_active is true order by l.list_id limit 1),
  visible_categories as (select category_item as category from public.categories c join active_menu l on l.list_id = c.list_id cross join lateral jsonb_array_elements(coalesce(c.category -> 'categories', '[]'::jsonb)) category_item where category_item ->> 'active' is distinct from 'false'),
  visible_products as (select p.category_id, coalesce(jsonb_agg(item) filter (where item ->> 'type' = 'divisor' or (item ->> 'active' is distinct from 'false' and item -> 'image' ->> 'active' is distinct from 'false')), '[]'::jsonb) as items from public.products p join visible_categories c on c.category ->> 'category_id' = p.category_id cross join lateral jsonb_array_elements(coalesce(p.product -> 'products', '[]'::jsonb)) item group by p.category_id)
  select case when exists (select 1 from active_menu) then jsonb_build_object('structure', (select jsonb_build_object('title', title, 'structure', structure) from selected_structure), 'list', (select jsonb_build_object('list_id', list_id, 'title', title) from active_menu), 'categories', coalesce((select jsonb_agg(category) from visible_categories), '[]'::jsonb), 'products', coalesce((select jsonb_object_agg(category_id, items) from visible_products), '{}'::jsonb)) else null end;
$$;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;
