/**
 * Reads and writes for dishes.
 *
 * One row holds every dish in a category, keyed by the category's id. `userId`
 * is required for the same reason as the other tables.
 */

import { supabase } from '../supabase.js'
import { ok, rows } from './query.js'

export function fetchProducts (categoryId) {
  return rows(
    supabase.from('products').select('*').eq('category_id', categoryId),
    'Could not load your dishes'
  )
}

export function upsertProducts ({ categoryId, userId, product }) {
  return ok(
    supabase.from('products').upsert({
      product_id: categoryId,
      category_id: categoryId,
      user_id: userId,
      product
    }),
    'Could not save your dishes'
  )
}

export function deleteProducts (categoryId) {
  return ok(
    supabase.from('products').delete().eq('category_id', categoryId),
    'Could not delete the dishes'
  )
}

/** Clears the dishes of several categories at once, when a menu is deleted. */
export function deleteProductsIn (categoryIds) {
  if (!categoryIds.length) return Promise.resolve()
  return ok(
    supabase.from('products').delete().in('category_id', categoryIds),
    'Could not delete the dishes'
  )
}
