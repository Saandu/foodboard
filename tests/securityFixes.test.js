import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

/**
 * Regression cases for the 2026-10-05 security audit, run against every
 * migration in order on an in-memory Postgres. Supabase's auth and storage
 * schemas are stubbed with just the columns the migrations touch.
 */

const a = '11111111-1111-4111-8111-111111111111'
const b = '22222222-2222-4222-8222-222222222222'
const demo = '99999999-9999-4999-8999-999999999999'
let db

const as = (user) => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
const asAnon = () => db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub', '', false);")
const asAdmin = () => db.exec('reset role;')
const count = async (sql) => (await db.query(`select count(*)::int as n from ${sql}`)).rows[0].n
const slugOf = async (id) => (await db.query('select public_slug from public.structures where structure_id = $1', [id])).rows[0]?.public_slug

describe('security audit fixes', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, email text, phone text, encrypted_password text, email_change text, phone_change text, raw_user_meta_data jsonb, last_sign_in_at timestamptz);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text, primary key (bucket_id, name));
      create function storage.foldername(name text) returns text[] language sql immutable as $$
        select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
      $$;
      grant usage on schema storage to authenticated, anon;
      grant execute on function storage.foldername(text) to authenticated, anon;
      grant select, insert, update, delete on storage.objects to authenticated, anon;
      alter table storage.objects enable row level security;
    `)
    for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
    }
    await db.exec(`
      grant usage on schema public to service_role, authenticated, anon;
      grant all on public.users, public.structures, public.lists, public.categories, public.products, public.protected_accounts to service_role;
      insert into auth.users(id, email, encrypted_password) values
        ('${a}', 'a@example.test', 'hash-a'), ('${b}', 'b@example.test', 'hash-b'), ('${demo}', 'demo@example.test', 'hash-demo');
    `)
  }, 60000)

  beforeEach(async () => {
    await asAdmin()
    await db.exec(`
      delete from public.products; delete from public.categories; delete from public.lists; delete from public.structures;
      delete from public.protected_accounts; delete from public.menu_import_attempts; delete from storage.objects;
      insert into public.structures(structure_id, user_id, title, structure) values ('sa', '${a}', 'A', '{}'), ('sb', '${b}', 'B', '{}');
      insert into public.lists(list_id, structure_id, user_id, title, is_active, has_sublists, data) values
        ('la', 'sa', '${a}', 'A menu', true, false, '{}'), ('lb', 'sb', '${b}', 'B menu', false, false, '{}');
      insert into public.categories(category_id, list_id, user_id, category) values
        ('la', 'la', '${a}', '{"categories":[{"category_id":"ca","name":"A mains"}]}'),
        ('lb', 'lb', '${b}', '{"categories":[{"category_id":"cb"}]}');
      insert into public.products(product_id, category_id, user_id, product) values ('ca', 'ca', '${a}', '{"products":[{"name":"A dish"}]}');
    `)
  })

  afterAll(async () => { await db?.close() })

  describe('1. children must hang off a parent their own account owns', () => {
    it('refuses a list under another account\'s restaurant', async () => {
      await as(b)
      await expect(db.query(`insert into public.lists(list_id, structure_id, user_id, title, is_active) values ('0', 'sa', '${b}', 'pwned', true)`)).rejects.toThrow(/row-level security/)
      await expect(db.query("update public.lists set structure_id = 'sa' where list_id = 'lb'")).rejects.toThrow(/row-level security/)
    })

    it('refuses a categories row under another account\'s menu', async () => {
      await as(b)
      await expect(db.query(`insert into public.categories(category_id, list_id, user_id, category) values ('x', 'la', '${b}', '{"categories":[]}')`)).rejects.toThrow(/row-level security/)
    })

    it('refuses copying another account\'s category id to attach dishes to it', async () => {
      await as(b)
      await expect(db.query('update public.categories set category = \'{"categories":[{"category_id":"cb"},{"category_id":"ca"}]}\' where category_id = \'lb\'')).rejects.toThrow('category_id_taken')
      await expect(db.query(`insert into public.products(product_id, category_id, user_id, product) values ('p', 'ca', '${b}', '{}')`)).rejects.toThrow('category_not_owned')
    })

    it('still lets an owner build their own menu', async () => {
      await as(b)
      await db.query(`insert into public.lists(list_id, structure_id, user_id, title, is_active) values ('lb2', 'sb', '${b}', 'B two', false)`)
      await db.query(`insert into public.categories(category_id, list_id, user_id, category) values ('lb2', 'lb2', '${b}', '{"categories":[{"category_id":"cb2"}]}')`)
      await db.query(`insert into public.products(product_id, category_id, user_id, product) values ('cb2', 'cb2', '${b}', '{}')`)
      expect(await count("public.products where user_id = current_setting('request.jwt.claim.sub')")).toBe(1)
    })

    it('publishes only the structure owner\'s rows even if a foreign row exists', async () => {
      await asAdmin()
      // Planted directly, as an old attack would have left it.
      await db.exec(`
        alter table public.categories disable trigger categories_check_ids_unclaimed;
        insert into public.lists(list_id, structure_id, user_id, title, is_active) values ('0', 'sa', '${b}', 'pwned', true);
        insert into public.categories(category_id, list_id, user_id, category) values ('x', 'la', '${b}', '{"categories":[{"category_id":"evil"},{"category_id":"ca"}]}');
        insert into public.products(product_id, category_id, user_id, product) values ('evil-ca', 'ca', '${b}', '{"products":[{"name":"injected"}]}');
        alter table public.categories enable trigger categories_check_ids_unclaimed;
      `)
      const slug = await slugOf('sa')
      await asAnon()
      const menu = (await db.query('select public.get_public_menu($1) as m', [slug])).rows[0].m
      expect(menu.list.list_id).toBe('la')
      expect(menu.categories.map(c => c.category_id)).toEqual(['ca'])
      expect(menu.products.ca).toEqual([{ name: 'A dish' }])
    })
  })

  describe('2. storage listing is owner-only', () => {
    it('hides other tenants\' objects from anon and from other accounts', async () => {
      await asAdmin()
      await db.exec(`insert into storage.objects(bucket_id, name) values ('structure-media', '${a}/sa/logo-1.webp'), ('structure-media', '${a}/feedback/attachment-1.png')`)
      await asAnon()
      expect(await count('storage.objects')).toBe(0)
      await as(b)
      expect(await count('storage.objects')).toBe(0)
      await as(a)
      expect(await count('storage.objects')).toBe(2)
    })
  })

  describe('3 + 4. public_slug is issued, never chosen', () => {
    it('refuses writing public_slug directly, on insert or update', async () => {
      await as(b)
      await expect(db.query("update public.structures set public_slug = 'anything' where structure_id = 'sb'")).rejects.toThrow(/permission denied/)
      await expect(db.query(`insert into public.structures(structure_id, user_id, public_slug) values ('sb2', '${b}', '../index')`)).rejects.toThrow(/permission denied/)
    })

    it('still lets owners create and edit restaurants, with a generated slug', async () => {
      await as(b)
      await db.query(`insert into public.structures(structure_id, user_id, title, structure) values ('sb2', '${b}', 'New', '{}')`)
      await db.query(`insert into public.structures(structure_id, user_id, title, structure) values ('sb2', '${b}', 'Renamed', '{}') on conflict (structure_id) do update set title = excluded.title, structure = excluded.structure`)
      expect((await db.query("select title, public_slug from public.structures where structure_id = 'sb2'")).rows[0]).toMatchObject({ title: 'Renamed', public_slug: expect.stringMatching(/^[0-9a-f]{22}$/) })
    })

    it('rotates only your own slug, and a rotated slug cannot be claimed', async () => {
      const old = await slugOf('sa')
      await as(b)
      await expect(db.query("select public.rotate_public_slug('sa')")).rejects.toThrow('not yours')
      await as(a)
      const fresh = (await db.query("select public.rotate_public_slug('sa') as s")).rows[0].s
      expect(fresh).not.toBe(old)
      await as(b)
      await expect(db.query('update public.structures set public_slug = $1 where structure_id = \'sb\'', [old])).rejects.toThrow(/permission denied/)
      await asAnon()
      expect((await db.query('select public.get_public_menu($1) as m', [old])).rows[0].m).toBeNull()
    })

    it('rejects a malformed slug even from the service role', async () => {
      await asAdmin()
      await expect(db.query("update public.structures set public_slug = '../index' where structure_id = 'sa'")).rejects.toThrow('structures_public_slug_format')
    })
  })

  describe('5. deleting an account does not refund the import budget', () => {
    it('keeps attempt rows when their auth user is deleted', async () => {
      await asAdmin()
      await db.exec(`
        insert into auth.users(id, email) values ('33333333-3333-4333-8333-333333333333', 'c@example.test');
        insert into public.menu_import_attempts(import_id, user_id) values ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333');
        delete from auth.users where id = '33333333-3333-4333-8333-333333333333';
      `)
      expect(await count('public.menu_import_attempts')).toBe(1)
    })
  })

  describe('6. the shared demo cannot delete or overwrite stored images', () => {
    it('refuses update and delete for a protected account, but not for others', async () => {
      await asAdmin()
      await db.exec(`
        insert into public.protected_accounts(user_id, reason) values ('${demo}', 'demo');
        insert into storage.objects(bucket_id, name) values ('structure-media', '${demo}/111/logo.webp'), ('structure-media', '${a}/sa/logo.webp');
      `)
      await as(demo)
      await db.query('delete from storage.objects')
      await db.query("update storage.objects set name = name || '.x'")
      await db.query(`insert into storage.objects(bucket_id, name) values ('structure-media', '${demo}/111/new.webp')`)
      await as(a)
      await db.query('delete from storage.objects')
      await asAdmin()
      expect((await db.query('select name from storage.objects order by name')).rows.map(r => r.name)).toEqual([`${demo}/111/logo.webp`, `${demo}/111/new.webp`])
    })
  })

  describe('7. the shared demo\'s credentials cannot be changed', () => {
    it('refuses password and email changes for a protected account only', async () => {
      await asAdmin()
      await db.exec(`insert into public.protected_accounts(user_id, reason) values ('${demo}', 'demo')`)
      await expect(db.query(`update auth.users set encrypted_password = 'new' where id = '${demo}'`)).rejects.toThrow('credentials cannot be changed')
      await expect(db.query(`update auth.users set email_change = 'x@example.test' where id = '${demo}'`)).rejects.toThrow('credentials cannot be changed')
      await db.query(`update auth.users set last_sign_in_at = now() where id = '${demo}'`)
      await db.query(`update auth.users set encrypted_password = 'new-a' where id = '${a}'`)
      await db.exec("set foodboard.allow_protected_credential_change = 'on'")
      await db.query(`update auth.users set encrypted_password = 'rotated' where id = '${demo}'`)
      await db.exec('reset foodboard.allow_protected_credential_change')
    })
  })

  describe('8. the showcase reset survives squatted ids', () => {
    const payload = {
      structures: [{ structure_id: '111', user_id: demo, public_slug: 'trattoria-mareluna', title: 'Demo', structure: {} }],
      lists: [{ list_id: '1111', structure_id: '111', user_id: demo, title: 'Menu', is_active: true, has_sublists: false, data: {} }],
      categories: [{ category_id: '1111', list_id: '1111', user_id: demo, category: { categories: [{ category_id: '11111' }] } }],
      products: [{ product_id: '11111', category_id: '11111', user_id: demo, product: { products: [{ name: 'Demo dish' }] } }]
    }
    const reset = () => db.query(
      'select public.reset_showcase($1, $2, $3, $4, $5, $6, true)',
      [demo, '[]', JSON.stringify(payload.structures), JSON.stringify(payload.lists), JSON.stringify(payload.categories), JSON.stringify(payload.products)]
    )

    it('clears another account\'s rows holding showcase ids and rebuilds', async () => {
      await asAdmin()
      await db.exec('set role service_role')
      await reset()
      await asAdmin()
      // What an attacker could have left behind before this migration.
      await db.exec(`
        delete from public.products where product_id = '11111';
        alter table public.categories disable trigger categories_check_ids_unclaimed;
        update public.categories set category = '{"categories":[{"category_id":"cb"},{"category_id":"11111"}]}' where category_id = 'lb';
        alter table public.categories enable trigger categories_check_ids_unclaimed;
        insert into public.products(product_id, category_id, user_id, product) values ('11111', '11111', '${b}', '{}');
        insert into public.lists(list_id, structure_id, user_id, title, is_active) values ('blocker', '111', '${b}', 'x', false);
        update public.structures set public_slug = 'aaaa' where structure_id = '111';
        update public.structures set public_slug = 'trattoria-mareluna' where structure_id = 'sb';
        set role service_role;
      `)
      await reset()
      await asAdmin()
      expect(await slugOf('111')).toBe('trattoria-mareluna')
      expect(await slugOf('sb')).not.toBe('trattoria-mareluna')
      expect((await db.query("select user_id from public.products where product_id = '11111'")).rows).toEqual([{ user_id: demo }])
      expect(await count("public.lists where list_id = 'blocker'")).toBe(0)
      expect(await count('public.protected_accounts')).toBe(1)
    })
  })
})
