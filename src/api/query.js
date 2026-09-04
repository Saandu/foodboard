/**
 * Shared result handling for the data-access modules in this folder.
 *
 * supabase-js resolves to `{ data, error }` rather than rejecting, so every
 * call site has to remember to check `error`. Forgetting is silent: the code
 * carries on with `data === null`. These helpers convert that into a thrown
 * error once, so the modules below read linearly and the store can use a
 * single try/catch per action.
 */

/**
 * Awaits a PostgREST query and returns its rows, throwing on failure.
 *
 * @param {PromiseLike<{data: unknown, error: {message: string} | null}>} query
 * @param {string} context what was being attempted, for the error message
 */
export async function rows (query, context) {
  const { data, error } = await query
  if (error) throw new Error(`${context}: ${error.message}`, { cause: error })
  return data
}

/**
 * Awaits a query run purely for its side effect, throwing on failure.
 *
 * @param {PromiseLike<{error: {message: string} | null}>} query
 * @param {string} context what was being attempted, for the error message
 */
export async function ok (query, context) {
  const { error } = await query
  if (error) throw new Error(`${context}: ${error.message}`, { cause: error })
}
