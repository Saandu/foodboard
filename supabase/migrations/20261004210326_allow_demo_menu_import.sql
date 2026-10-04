-- Shared demo imports use the same ownership, quota and atomic-save checks.
-- Account deletion protection remains unchanged.

create or replace function public.reserve_menu_import(p_user_id uuid, p_structure_id text, p_import_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  -- Serialize the project-wide reservation: concurrent users cannot beat limits.
  perform pg_catalog.pg_advisory_xact_lock(74628109);
  if not exists (select 1 from public.structures where structure_id = p_structure_id and user_id = p_user_id::text) then
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

create or replace function public.save_imported_menu(p_user_id uuid, p_import_id uuid, p_records jsonb)
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
  if not found then raise exception 'not_owner'; end if;
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
