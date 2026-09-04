/** Writes for the in-app feedback form. */

import { supabase } from '../supabase.js'
import { ok } from './query.js'

/**
 * Files a report against the signed-in account.
 *
 * `userId` is passed explicitly rather than read from a store: the row has to
 * satisfy `feedback_insert_own`, which compares it to auth.uid().
 */
export function insertFeedback ({ userId, subject, message, attachment }) {
  return ok(
    supabase.from('feedback').insert({
      user_id: userId,
      subject,
      message,
      attachment: attachment || null
    }),
    'Could not send the report'
  )
}
