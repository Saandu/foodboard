import { describe, expect, it } from 'vitest'
import { ATTEMPTS, isTransient, request } from '../scripts/retry.js'

/**
 * The demo reset wipes before it inserts. A request that dies between the two
 * leaves the public showcase empty for hours, which is exactly what a dropped
 * connection did on 2026-09-11. These pin down what gets retried and what does
 * not.
 */

const noWait = { warn: () => {}, wait: async () => {} }

/** A supabase-js-shaped call that fails `failures` times, then succeeds. */
const flaky = (failures, error) => {
  let calls = 0
  const run = async () => (++calls <= failures ? { error } : { data: 'ok', error: null })
  return { run, calls: () => calls }
}

describe('isTransient', () => {
  it('treats a dropped connection as transient', () => {
    expect(isTransient(new TypeError('fetch failed'))).toBe(true)
    expect(isTransient({ message: 'read ECONNRESET' })).toBe(true)
    expect(isTransient({ message: 'Bad Gateway', code: 502 })).toBe(true)
  })

  it('does not retry the data telling it no', () => {
    expect(isTransient({ message: 'duplicate key value violates unique constraint' })).toBe(false)
    expect(isTransient({ message: 'new row violates row-level security policy' })).toBe(false)
    expect(isTransient({ message: 'permission denied for table products' })).toBe(false)
    expect(isTransient(undefined)).toBe(false)
  })
})

describe('request', () => {
  it('returns the first success without waiting', async () => {
    const { run, calls } = flaky(0)
    expect((await request('x', run, noWait)).data).toBe('ok')
    expect(calls()).toBe(1)
  })

  it('retries a transient failure and returns the eventual success', async () => {
    const { run, calls } = flaky(2, new TypeError('fetch failed'))
    const waits = []
    const result = await request('clear products', run, { ...noWait, wait: async (ms) => { waits.push(ms) } })
    expect(result.data).toBe('ok')
    expect(calls()).toBe(3)
    expect(waits).toEqual([1000, 3000])
  })

  it('gives up after the last attempt and hands back the error', async () => {
    const { run, calls } = flaky(Infinity, new TypeError('fetch failed'))
    const result = await request('x', run, noWait)
    expect(result.error.message).toBe('fetch failed')
    expect(calls()).toBe(ATTEMPTS)
  })

  it('does not retry a failure that will not fix itself', async () => {
    const { run, calls } = flaky(Infinity, { message: 'duplicate key value violates unique constraint' })
    const result = await request('x', run, noWait)
    expect(result.error.message).toContain('duplicate key')
    expect(calls()).toBe(1)
  })

  it('folds a thrown error into the { error } shape', async () => {
    const result = await request('x', async () => { throw new Error('duplicate key') }, noWait)
    expect(result.error.message).toBe('duplicate key')
  })

  it('calls run afresh on every attempt, since a query builder cannot be awaited twice', async () => {
    let built = 0
    const run = () => { built++; return Promise.resolve(built < 3 ? { error: new TypeError('fetch failed') } : { data: built }) }
    expect((await request('x', run, noWait)).data).toBe(3)
  })
})
