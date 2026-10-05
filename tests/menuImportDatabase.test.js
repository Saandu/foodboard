import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { buildMenuRecords } from '../supabase/functions/_shared/menu-records.js'

const a = '11111111-1111-4111-8111-111111111111'
const b = '22222222-2222-4222-8222-222222222222'
const importId = '33333333-3333-4333-8333-333333333333'
const draft = { title: 'Lunch', language: 'en', currency: 'EUR', warnings: [], categories: [{ name: 'Mains', description: '', items: [{ name: 'Pasta', description: '', prices: [{ amount: '12.50', label: '' }], allergens: [6], warning: '' }] }] }
const records = () => { let index = 0; return buildMenuRecords(draft, 'a-restaurant', a, () => `${importId}-${index++}`) }
let db
const save = (owner = a, payload = records(), id = importId) => db.query('select public.save_imported_menu($1::uuid, $2::uuid, $3::jsonb) as result', [owner, id, JSON.stringify(payload)])
const reserve = (owner = a, id = importId, structure = 'a-restaurant') => db.query('select public.reserve_menu_import($1::uuid, $2, $3::uuid)', [owner, structure, id])

describe('menu import migrations in PostgreSQL', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `)
    for (const file of ['20260814000000_create_core_tables.sql', '20260816010000_enable_private_workspaces.sql', '20260906000000_protect_shared_accounts.sql', '20261004191254_menu_import.sql', '20261004210326_allow_demo_menu_import.sql', '20261004212307_workspace_deletion.sql', '20261005090000_guard_workspace_deletion.sql']) {
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
    }
    // Supabase's platform supplies the service role's core-table privileges.
    await db.exec(`
      grant usage on schema public to service_role, authenticated, anon;
      grant all on public.users, public.structures, public.lists, public.categories, public.products to service_role;
      insert into auth.users(id, email) values ('${a}', 'a@example.test'), ('${b}', 'b@example.test');
      insert into public.structures(structure_id, user_id) values ('a-restaurant', '${a}'), ('b-restaurant', '${b}');
    `)
  }, 30000)
  beforeEach(async () => {
    await db.exec('reset role; truncate public.products, public.categories, public.lists, public.menu_import_receipts, public.menu_import_attempts; delete from public.protected_accounts; set role service_role;')
  })
  afterAll(async () => { await db?.close() })

  it('saves descriptors atomically and retries return the same unpublished list', async () => {
    const first = await save()
    const retry = await save()
    expect(first.rows[0].result).toEqual(retry.rows[0].result)
    expect((await db.query('select is_active from public.lists')).rows).toEqual([{ is_active: false }])
    expect((await db.query('select count(*)::int as count from public.products')).rows[0].count).toBe(1)
  })
  it('deletes an owned menu and nested dishes while denying another owner', async () => {
    await save()
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${b}', false);`)
    await expect(db.query('select public.delete_menu_workspace($1)', [`${importId}-0`])).rejects.toThrow('not_owner')
    await db.exec(`select set_config('request.jwt.claim.sub', '${a}', false);`)
    await db.query('select public.delete_menu_workspace($1)', [`${importId}-0`])
    expect((await db.query('select count(*)::int as count from public.products')).rows[0].count).toBe(0)
    expect((await db.query('select count(*)::int as count from public.lists')).rows[0].count).toBe(0)
    expect((await db.query('select count(*)::int as count from public.structures')).rows[0].count).toBe(1)
  })
  it('rolls back all deletion when a nested delete fails', async () => {
    await save()
    await db.exec(`reset role;
      create function public.fail_category_delete() returns trigger language plpgsql as $$ begin raise exception 'test_failure'; end $$;
      create trigger test_delete_failure before delete on public.categories for each row execute function public.fail_category_delete();
      set role authenticated; select set_config('request.jwt.claim.sub', '${a}', false);`)
    try {
      await expect(db.query('select public.delete_menu_workspace($1)', [`${importId}-0`])).rejects.toThrow('test_failure')
      expect((await db.query('select count(*)::int as count from public.products')).rows[0].count).toBe(1)
      expect((await db.query('select count(*)::int as count from public.lists')).rows[0].count).toBe(1)
    } finally {
      await db.exec('reset role; drop trigger test_delete_failure on public.categories; drop function public.fail_category_delete();')
    }
  })
  it('deletes a restaurant and its menus while preserving another owner', async () => {
    await save()
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${b}', false);`)
    await expect(db.query("select public.delete_restaurant_workspace('a-restaurant')")).rejects.toThrow('not_owner')
    await db.exec(`select set_config('request.jwt.claim.sub', '${a}', false);`)
    await db.query("select public.delete_restaurant_workspace('a-restaurant')")
    expect((await db.query('select count(*)::int as count from public.products')).rows[0].count).toBe(0)
    await db.exec(`select set_config('request.jwt.claim.sub', '${b}', false);`)
    expect((await db.query('select structure_id from public.structures')).rows).toEqual([{ structure_id: 'b-restaurant' }])
    await db.exec(`reset role; insert into public.structures(structure_id,user_id) values ('a-restaurant','${a}');`)
  })
  it('protected accounts cannot delete menus or restaurants, even with direct deletes', async () => {
    await save()
    await db.exec(`reset role; insert into public.protected_accounts(user_id, reason) values ('${a}', 'demo'); set role authenticated; select set_config('request.jwt.claim.sub', '${a}', false);`)
    await expect(db.query('select public.delete_menu_workspace($1)', [`${importId}-0`])).rejects.toThrow('protected_account')
    await expect(db.query("select public.delete_restaurant_workspace('a-restaurant')")).rejects.toThrow('protected_account')
    await db.exec("delete from public.lists; delete from public.structures where structure_id = 'a-restaurant'")
    expect((await db.query('select count(*)::int as count from public.lists')).rows[0].count).toBe(1)
    expect((await db.query('select count(*)::int as count from public.structures')).rows[0].count).toBe(1)
    await db.exec('reset role;')
  })
  it('returns only the image paths no remaining row still references', async () => {
    const photo = (path) => ({ editModal: [{ type: 'file', value: path, active: true }] })
    const shared = `${a}/a-restaurant/dish-shared.webp`
    const own = `${a}/a-restaurant/dish-own.webp`
    const logo = `${a}/a-restaurant/logo-1.webp`
    await db.exec(`reset role;
      update public.structures set structure = '${JSON.stringify({ logo })}' where structure_id = 'a-restaurant';
      insert into public.lists(list_id, structure_id, user_id, title, is_active, has_sublists, data) values
        ('m1', 'a-restaurant', '${a}', 'One', false, false, '{}'), ('m2', 'a-restaurant', '${a}', 'Two', false, false, '{}');
      insert into public.categories(category_id, list_id, user_id, category) values
        ('m1', 'm1', '${a}', '{"categories":[{"category_id":"c1"}]}'), ('m2', 'm2', '${a}', '{"categories":[{"category_id":"c2"}]}');
      insert into public.products(product_id, category_id, user_id, product) values
        ('c1', 'c1', '${a}', '${JSON.stringify({ items: [photo(shared), photo(own), photo('data:image/png;base64,AA')] })}'),
        ('c2', 'c2', '${a}', '${JSON.stringify({ items: [photo(shared)] })}');
      set role authenticated; select set_config('request.jwt.claim.sub', '${a}', false);`)
    expect((await db.query("select public.delete_menu_workspace('m1') as paths")).rows[0].paths).toEqual([own])
    expect((await db.query("select public.delete_restaurant_workspace('a-restaurant') as paths")).rows[0].paths.sort()).toEqual([logo, shared].sort())
    await db.exec(`reset role; insert into public.structures(structure_id,user_id) values ('a-restaurant','${a}');`)
  })
  it('rejects another owner and changed retry content while allowing protected-demo imports', async () => {
    await expect(save(b)).rejects.toThrow('not_owner')
    await save()
    const changed = records()
    changed.list.title = 'Different title'
    await expect(save(a, changed)).rejects.toThrow('import_conflict')
    await db.exec(`reset role; insert into public.protected_accounts(user_id, reason) values ('${a}', 'demo'); set role service_role;`)
    await expect(save()).resolves.toBeDefined()
    await expect(reserve()).resolves.toBeDefined()
  })
  it('rolls back the list and categories when a product insert fails', async () => {
    const broken = records()
    broken.products.push(broken.products[0])
    broken.categories.category.categories.push(broken.categories.category.categories[0])
    await expect(save(a, broken)).rejects.toThrow()
    expect((await db.query('select count(*)::int as count from public.lists')).rows[0].count).toBe(0)
    expect((await db.query('select count(*)::int as count from public.categories')).rows[0].count).toBe(0)
  })
  it('browser roles cannot call service RPCs or read quota/receipt tables', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role};`)
      await expect(save()).rejects.toThrow('permission denied')
      await expect(reserve()).rejects.toThrow('permission denied')
      await expect(db.query('select * from public.menu_import_attempts')).rejects.toThrow('permission denied')
    }
  })
  it('the replacement category check prevents cross-tenant product writes', async () => {
    await save()
    await db.exec(`reset role; set request.jwt.claim.sub = '${b}'; set role authenticated;`)
    await expect(db.query('insert into public.products(product_id, category_id, user_id, product) values ($1, $2, $3, $4)', ['evil', records().products[0].category_id, b, '{}'])).rejects.toThrow('category_not_owned')
  })
  it('reserves before spending and enforces cooldown and daily caps', async () => {
    await reserve()
    await expect(reserve(a, '44444444-4444-4444-8444-444444444444')).rejects.toThrow('import_limit_reached')
    await db.exec(`reset role;
      update public.menu_import_attempts set created_at = now() - interval '2 minutes';
      insert into public.menu_import_attempts(import_id,user_id,created_at) values
      ('55555555-5555-4555-8555-555555555555','${a}',now() - interval '3 minutes'),
      ('66666666-6666-4666-8666-666666666666','${a}',now() - interval '4 minutes');
      set role service_role;`)
    await expect(reserve(a, '77777777-7777-4777-8777-777777777777')).rejects.toThrow('import_limit_reached')
    await expect(reserve(b, importId, 'a-restaurant')).rejects.toThrow('not_owner')
  })
  it('caps project-wide extraction and purges old reservation data', async () => {
    await db.exec(`reset role;
      insert into public.menu_import_attempts(import_id,user_id,created_at)
      select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, '${b}', now() - interval '5 minutes' from generate_series(1,20) n;
      set role service_role;`)
    await expect(reserve()).rejects.toThrow('import_limit_reached')
    await db.exec("reset role; update public.menu_import_attempts set created_at = now() - interval '3 days'; set role service_role;")
    await reserve()
    expect((await db.query('select count(*)::int as count from public.menu_import_attempts')).rows[0].count).toBe(1)
  })
})
