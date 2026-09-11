/* ------------------------------------------------------------------ *
 * Transient-failure retry for supabase-js calls
 *
 * The demo reset is a wipe followed by inserts, so a request that dies in
 * the middle leaves the showcase empty until the next scheduled run — hours,
 * on the public demo. That happened: a scheduled run lost its connection on
 * the second delete, after products were already gone.
 *
 * supabase-js reports failures as `{ error }` rather than throwing, and a
 * dropped connection arrives as a bare "fetch failed". Retry only what looks
 * like the network or the platform rather than the data — a constraint
 * violation will not fix itself and should surface immediately.
 *
 * Kept apart from seed.js, which reads credentials on import, so the retry
 * rules can be tested without any.
 * ------------------------------------------------------------------ */

export const ATTEMPTS = 4
export const BACKOFF_MS = [1000, 3000, 9000]

const TRANSIENT = /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|network|timeout|\b50[234]\b/i

/** Whether an error is worth retrying: the network or the platform, not the data. */
export const isTransient = (error) =>
  TRANSIENT.test(error?.message || '') || TRANSIENT.test(String(error?.code || ''))

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Runs a supabase-js query, retrying transient failures with backoff.
 *
 * `run` is called afresh each attempt — a query builder cannot be awaited
 * twice. A thrown error is folded into the `{ error }` shape so callers keep
 * one code path. `warn` and `wait` are injectable for tests.
 */
export async function request (label, run, { warn = console.warn, wait = sleep } = {}) {
  for (let attempt = 1; ; attempt++) {
    const result = await Promise.resolve().then(run).then(r => r, err => ({ error: err }))
    if (!result.error) return result
    if (attempt >= ATTEMPTS || !isTransient(result.error)) return result
    const delay = BACKOFF_MS[attempt - 1]
    warn(`  ${label}: ${result.error.message} — retrying in ${delay / 1000}s (${attempt}/${ATTEMPTS - 1})`)
    await wait(delay)
  }
}
