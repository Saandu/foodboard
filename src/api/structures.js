/** Reads and writes for restaurants (one row per venue). */

import { supabase } from '../supabase.js'
import { rows } from './query.js'

/** Every restaurant owned by an account, oldest first. */
export function fetchStructures (userId) {
  return rows(
    supabase.from('structures').select('*').eq('user_id', userId).order('structure_id'),
    'Could not load your restaurants'
  )
}

/**
 * Creates a restaurant and returns the stored row.
 *
 * The row is read back rather than assumed: `public_slug` comes from a column
 * default, and the share link cannot be built without it.
 */
export function insertStructure ({ structureId, userId, title, structure }) {
  return rows(
    supabase
      .from('structures')
      .insert({ structure_id: structureId, user_id: userId, title, structure })
      .select()
      .single(),
    'Could not create the restaurant'
  )
}

export function upsertStructure ({ structureId, userId, title, structure }) {
  return rows(
    supabase
      .from('structures')
      .upsert({ structure_id: structureId, user_id: userId, title, structure }),
    'Could not save the restaurant'
  )
}

/**
 * Issues a fresh public slug, which immediately kills the previous link.
 *
 * The function is `security invoker`, so the structures RLS policy is what
 * stops one account rotating another's link.
 */
export async function rotatePublicSlug (structureId) {
  const { data, error } = await supabase.rpc('rotate_public_slug', { p_structure_id: structureId })
  if (error) throw new Error(`Could not rotate the link: ${error.message}`, { cause: error })
  return data
}

/** The published menu for a slug, or null when nothing is published there. */
export async function fetchPublicMenu (slug) {
  const { data, error } = await supabase.rpc('get_public_menu', { p_slug: slug })
  if (error) throw new Error(`Could not load the menu: ${error.message}`, { cause: error })
  return data
}
