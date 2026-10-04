-- Service-only import controls. The Edge Function verifies the user with Auth
-- before calling these functions; browser roles cannot bypass quotas or save RPCs.
create table public.menu_import_attempts (
  import_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text,
  usage jsonb,
  created_at timestamptz not null default now()
);
create index menu_import_attempts_user_time_idx on public.menu_import_attempts(user_id, created_at);
create index menu_import_attempts_time_idx on public.menu_import_attempts(created_at);
create table public.menu_import_receipts (
  import_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id text not null,
  payload_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.menu_import_attempts enable row level security;
alter table public.menu_import_receipts enable row level security;
revoke all on public.menu_import_attempts, public.menu_import_receipts from public, anon, authenticated;
grant select, insert, update, delete on public.menu_import_attempts to service_role;
grant select, insert on public.menu_import_receipts to service_role;

create function public.reserve_menu_import(p_user_id uuid, p_structure_id text, p_import_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  -- Serialize the project-wide reservation: concurrent users cannot beat limits.
  perform pg_catalog.pg_advisory_xact_lock(74628109);
  if not exists (select 1 from public.structures where structure_id = p_structure_id and user_id = p_user_id::text)
     or exists (select 1 from public.protected_accounts where user_id = p_user_id::text) then
    raise exception 'not_owner';
  end if;
  delete from public.menu_import_attempts where created_at < now() - interval '2 days';
  if exists (select 1 from public.menu_import_attempts where import_id = p_import_id)
     or exists (select 1 from public.menu_import_attempts where created_at > now() - interval '15 seconds')
     or exists (select 1 from public.menu_import_attempts where user_id = p_user_id and created_at > now() - interval '60 seconds')
     or (select count(*) from public.menu_import_attempts where user_id = p_user_id and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 3
     or (select count(*) from public.menu_import_attempts where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 20 then
    raise exception 'import_limit_reached';
  end if;
  insert into public.menu_import_attempts(import_id, user_id) values(p_import_id, p_user_id);
end;
$$;
revoke all on function public.reserve_menu_import(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_menu_import(uuid, text, uuid) to service_role;
grant select on public.protected_accounts to service_role;

-- Categories are nested inside categories.category, not separate relational
-- rows. The original FK cannot represent the editor's actual storage contract.
alter table public.products drop constraint if exists products_category_id_fkey;
create function public.check_product_category_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.categories c
    cross join lateral jsonb_array_elements(coalesce(c.category->'categories', '[]'::jsonb)) item
    where c.user_id = new.user_id and item->>'category_id' = new.category_id
  ) then raise exception 'category_not_owned'; end if;
  return new;
end;
$$;
revoke all on function public.check_product_category_owner() from public, anon, authenticated;
create trigger products_check_category_owner before insert or update of category_id, user_id on public.products
for each row execute function public.check_product_category_owner();

create function public.save_imported_menu(p_user_id uuid, p_import_id uuid, p_records jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  l jsonb := p_records->'list';
  c jsonb := p_records->'categories';
  receipt public.menu_import_receipts%rowtype;
  list_id_value text := l->>'list_id';
  signature text := md5(p_records::text);
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_import_id::text, 0));
  -- Also lock the parent so deletion/reassignment cannot race the ownership check.
  perform 1 from public.structures where structure_id = l->>'structure_id' and user_id = p_user_id::text for update;
  if not found or exists (select 1 from public.protected_accounts where user_id = p_user_id::text) then raise exception 'not_owner'; end if;
  select * into receipt from public.menu_import_receipts where import_id = p_import_id;
  if found then
    if receipt.user_id <> p_user_id or receipt.payload_hash <> signature then raise exception 'import_conflict'; end if;
    return jsonb_build_object('list_id', receipt.list_id);
  end if;
  if l->>'user_id' is distinct from p_user_id::text or c->>'user_id' is distinct from p_user_id::text
     or c->>'list_id' is distinct from list_id_value or c->>'category_id' is distinct from list_id_value
     or l->>'is_active' is distinct from 'false' or l->'data'->>'active' is distinct from 'false'
     or jsonb_typeof(p_records->'products') is distinct from 'array'
     or jsonb_array_length(p_records->'products') not between 1 and 20
     or jsonb_typeof(c->'category'->'categories') is distinct from 'array'
     or jsonb_array_length(c->'category'->'categories') <> jsonb_array_length(p_records->'products') then raise exception 'invalid_import'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_records->'products') p
    where p->>'user_id' is distinct from p_user_id::text or p->>'product_id' is distinct from p->>'category_id'
      or not exists (select 1 from jsonb_array_elements(c->'category'->'categories') cat where cat->>'category_id' = p->>'category_id')
  ) then raise exception 'invalid_import'; end if;
  insert into public.lists(list_id, structure_id, user_id, title, is_active, has_sublists, data)
  values(list_id_value, l->>'structure_id', p_user_id::text, l->>'title', false, false, l->'data');
  insert into public.categories(category_id, list_id, user_id, category)
  values(list_id_value, list_id_value, p_user_id::text, c->'category');
  insert into public.products(product_id, category_id, user_id, product)
  select p->>'product_id', p->>'category_id', p_user_id::text, p->'product' from jsonb_array_elements(p_records->'products') p;
  insert into public.menu_import_receipts(import_id, user_id, list_id, payload_hash)
  values(p_import_id, p_user_id, list_id_value, signature);
  return jsonb_build_object('list_id', list_id_value);
end;
$$;
revoke all on function public.save_imported_menu(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_imported_menu(uuid, uuid, jsonb) to service_role;
