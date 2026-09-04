import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from '../scripts/env.js'

/**
 * Row Level Security, asserted against a real project.
 *
 * This is the security property the whole app rests on: two accounts must not
 * be able to see or touch each other's workspace. Unit tests cannot prove it —
 * the rules live in Postgres — so this signs in as two accounts for real.
 *
 * Skipped unless four extra variables are set, because it needs two confirmed
 * accounts that already exist:
 *
 *   RLS_TEST_A_EMAIL / RLS_TEST_A_PASSWORD
 *   RLS_TEST_B_EMAIL / RLS_TEST_B_PASSWORD
 *
 * Use throwaway accounts. The suite writes one structure as A and removes it
 * again, and never touches anything it did not create.
 */

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const accountA = { email: process.env.RLS_TEST_A_EMAIL, password: process.env.RLS_TEST_A_PASSWORD }
const accountB = { email: process.env.RLS_TEST_B_EMAIL, password: process.env.RLS_TEST_B_PASSWORD }

const configured = Boolean(
  url && publishableKey &&
  accountA.email && accountA.password &&
  accountB.email && accountB.password
)

if (!configured) {
  console.warn('RLS suite skipped — set RLS_TEST_A_* and RLS_TEST_B_* to run it (see tests/rls.test.js).')
}

const newClient = () => createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const signIn = async (credentials) => {
  const client = newClient()
  const { data, error } = await client.auth.signInWithPassword(credentials)
  if (error) throw new Error(`Could not sign in as ${credentials.email}: ${error.message}`)
  return { client, userId: data.user.id }
}

describe.skipIf(!configured)('RLS keeps workspaces private', () => {
  const structureId = `rls-test-${Date.now().toString(36)}`
  let alice
  let bob

  beforeAll(async () => {
    alice = await signIn(accountA)
    bob = await signIn(accountB)

    const { error } = await alice.client.from('structures').insert({
      structure_id: structureId,
      user_id: alice.userId,
      title: 'RLS fixture',
      structure: {}
    })
    if (error) throw new Error(`Fixture insert failed: ${error.message}`)
  })

  afterAll(async () => {
    await alice?.client.from('structures').delete().eq('structure_id', structureId)
    await alice?.client.auth.signOut()
    await bob?.client.auth.signOut()
  })

  it('lets the owner read their own row', async () => {
    const { data, error } = await alice.client
      .from('structures').select('structure_id').eq('structure_id', structureId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('hides the row from the other account', async () => {
    const { data, error } = await bob.client
      .from('structures').select('structure_id').eq('structure_id', structureId)
    // A filtered-out row reads as an empty result, not an error.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('does not leak the row through an unfiltered select', async () => {
    const { data, error } = await bob.client.from('structures').select('structure_id, user_id')
    expect(error).toBeNull()
    expect(data.some(row => row.structure_id === structureId)).toBe(false)
    expect(data.every(row => row.user_id === bob.userId)).toBe(true)
  })

  it('refuses a cross-account update', async () => {
    const { error } = await bob.client
      .from('structures').update({ title: 'hijacked' }).eq('structure_id', structureId)
    // The update policy matches nothing, so this is a no-op rather than an error.
    expect(error).toBeNull()

    const { data } = await alice.client
      .from('structures').select('title').eq('structure_id', structureId).single()
    expect(data.title).toBe('RLS fixture')
  })

  it('refuses a cross-account delete', async () => {
    await bob.client.from('structures').delete().eq('structure_id', structureId)

    const { data } = await alice.client
      .from('structures').select('structure_id').eq('structure_id', structureId)
    expect(data).toHaveLength(1)
  })

  it('refuses an insert that claims another account as owner', async () => {
    const { error } = await bob.client.from('structures').insert({
      structure_id: `${structureId}-forged`,
      user_id: alice.userId,
      title: 'forged',
      structure: {}
    })
    expect(error).not.toBeNull()
  })

  it('gives anonymous callers nothing at all', async () => {
    const anon = newClient()
    for (const table of ['users', 'structures', 'lists', 'categories', 'products']) {
      const { data, error } = await anon.from(table).select('*')
      // `anon` is revoked from every table, so this is an outright failure.
      expect(error, `${table} should reject anon`).not.toBeNull()
      expect(data).toBeNull()
    }
  })

  it('still lets anonymous callers open a published menu by slug', async () => {
    const anon = newClient()
    const { data, error } = await anon.rpc('get_public_menu', { p_slug: 'no-such-menu-slug' })
    // The narrow RPC is the one thing anon may call: reachable, and null for
    // a slug that does not resolve.
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('does not expose a structure through the public RPC by its id', async () => {
    const anon = newClient()
    const { data } = await anon.rpc('get_public_menu', { p_slug: structureId })
    expect(data).toBeNull()
  })
})
