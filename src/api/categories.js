/**
 * Reads and writes for categories.
 *
 * One row holds every category in a menu, keyed by the menu's id — see the
 * data-model note in README.md. As with lists, `userId` is a required argument
 * because the column is NOT NULL behind an ownership policy.
 */

import { supabase } from '../supabase.js'
import { ok, rows } from './query.js'

export function fetchCategories (listId) {
  return rows(
    supabase.from('categories').select('*').eq('list_id', listId),
    'Could not load your categories'
  )
}

/** The raw category group for a menu, used when duplicating. */
export function fetchCategoryGroup (listId) {
  return rows(
    supabase.from('categories').select('category').eq('list_id', listId).limit(1),
    'Could not read the categories to copy'
  )
}

export function insertCategories ({ listId, userId, category }) {
  return ok(
    supabase.from('categories').insert({
      category_id: listId,
      list_id: listId,
      user_id: userId,
      category
    }),
    'Could not create the categories'
  )
}

export function upsertCategories ({ listId, userId, category }) {
  return ok(
    supabase.from('categories').upsert({
      category_id: listId,
      list_id: listId,
      user_id: userId,
      category
    }),
    'Could not save the categories'
  )
}

export function deleteCategoriesForList (listId) {
  return ok(
    supabase.from('categories').delete().eq('list_id', listId),
    'Could not delete the categories'
  )
}
