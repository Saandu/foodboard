/** Reads and writes for the signed-in account's profile row. */

import { supabase } from '../supabase.js'
import { rows } from './query.js'

/** The profile row for an account, or null when the signup trigger has not run. */
export function fetchUser (userId) {
  return rows(
    supabase.from('users').select('*').eq('user_id', userId).maybeSingle(),
    'Could not load your profile'
  )
}

/**
 * Closes the caller's own account.
 *
 * The function takes no argument on purpose: it derives the target from
 * auth.uid() in Postgres, so there is no id to tamper with. See
 * supabase/migrations/20260816160000_account_deletion.sql.
 */
export async function deleteAccount () {
  const { error } = await supabase.rpc('delete_account')
  if (error) throw new Error(`Could not delete the account: ${error.message}`, { cause: error })
}
