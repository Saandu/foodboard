import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Every workspace table has a NOT NULL `user_id` behind an RLS policy that
 * compares it to auth.uid(). A write that omits it therefore fails at the
 * database — which is exactly what used to happen when duplicating a menu:
 * the two inserts in that path were the only writes in the app that did not
 * set the column, so "Duplicate" could never have worked.
 *
 * These tests pin the ownership column onto every write, so the same omission
 * cannot come back unnoticed.
 */

const writes = []

/** Records what was sent to PostgREST instead of talking to a real database. */
const table = (name) => ({
  insert: (payload) => { writes.push({ table: name, op: 'insert', payload }); return Promise.resolve({ error: null }) },
  upsert: (payload) => { writes.push({ table: name, op: 'upsert', payload }); return Promise.resolve({ data: payload, error: null }) }
})

vi.mock('../src/supabase.js', () => ({
  supabase: { from: (name) => table(name) }
}))

const { insertList, upsertList } = await import('../src/api/lists.js')
const { insertCategories, upsertCategories } = await import('../src/api/categories.js')
const { upsertProducts } = await import('../src/api/products.js')
const { insertFeedback } = await import('../src/api/feedback.js')

beforeEach(() => { writes.length = 0 })

const OWNER = '5519f9b7-ee41-4a1e-9d5a-7f0f6a2b1c33'

describe('writes carry the owner', () => {
  it('insertList sends user_id', async () => {
    await insertList({ listId: 'l1', structureId: '111', userId: OWNER, title: 'Lunch', isActive: false, data: {} })
    expect(writes[0].payload.user_id).toBe(OWNER)
  })

  it('upsertList sends user_id', async () => {
    await upsertList({ listId: 'l1', structureId: '111', userId: OWNER, title: 'Lunch', isActive: true, data: {} })
    expect(writes[0].payload.user_id).toBe(OWNER)
  })

  it('insertCategories sends user_id', async () => {
    await insertCategories({ listId: 'l1', userId: OWNER, category: { categories: [] } })
    expect(writes[0].payload.user_id).toBe(OWNER)
  })

  it('upsertCategories sends user_id', async () => {
    await upsertCategories({ listId: 'l1', userId: OWNER, category: { categories: [] } })
    expect(writes[0].payload.user_id).toBe(OWNER)
  })

  it('upsertProducts sends user_id', async () => {
    await upsertProducts({ categoryId: 'c1', userId: OWNER, product: { products: [] } })
    expect(writes[0].payload.user_id).toBe(OWNER)
  })

  it('insertFeedback sends user_id', async () => {
    await insertFeedback({ userId: OWNER, subject: 'Hi', message: 'There' })
    expect(writes[0].payload.user_id).toBe(OWNER)
  })
})

describe('row keys', () => {
  it('keys a category group by its menu id, since one row holds them all', async () => {
    await insertCategories({ listId: 'l1', userId: OWNER, category: { categories: [] } })
    expect(writes[0].payload).toMatchObject({ category_id: 'l1', list_id: 'l1' })
  })

  it('keys a product group by its category id', async () => {
    await upsertProducts({ categoryId: 'c1', userId: OWNER, product: { products: [] } })
    expect(writes[0].payload).toMatchObject({ product_id: 'c1', category_id: 'c1' })
  })

  it('stores a missing attachment as null rather than an empty string', async () => {
    await insertFeedback({ userId: OWNER, subject: 'Hi', message: 'There', attachment: '' })
    expect(writes[0].payload.attachment).toBeNull()
  })
})

describe('failures surface', () => {
  it('throws with context when PostgREST reports an error', async () => {
    vi.resetModules()
    vi.doMock('../src/supabase.js', () => ({
      supabase: {
        from: () => ({ insert: () => Promise.resolve({ error: { message: 'null value in column "user_id"' } }) })
      }
    }))
    const { insertList: failing } = await import('../src/api/lists.js')

    await expect(
      failing({ listId: 'l1', structureId: '111', userId: OWNER, title: 'x', isActive: true, data: {} })
    ).rejects.toThrow(/Could not create the menu: null value in column "user_id"/)
  })
})
