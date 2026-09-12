-- Reset the shared showcase in one database transaction.
--
-- The previous seed script issued separate HTTP requests for every delete and
-- insert. A transient network failure could therefore leave the public demo
-- empty or only partly rebuilt. Postgres functions run in a transaction: any
-- validation or insert failure rolls the whole reset back.

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
  'Atomically replaces every row belonging to the configured shared showcase account.';

revoke all on function public.reset_showcase(text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.reset_showcase(text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean)
  to service_role;
