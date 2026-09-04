/**
 * Reads and writes for menus ("lists" in the schema — one restaurant has many,
 * of which one is published at a time).
 *
 * Every write takes `userId` as a required argument rather than reading it
 * from a store. `lists.user_id` is NOT NULL and the insert policy compares it
 * to auth.uid(), so a write that omits it fails at the database. Making it
 * part of the signature is what stops that being forgotten.
 */

import { supabase } from '../supabase.js'
import { ok, rows } from './query.js'

export function fetchLists (structureId) {
  return rows(
    supabase.from('lists').select('*').eq('structure_id', structureId).order('list_id'),
    'Could not load your menus'
  )
}

export function insertList ({ listId, structureId, userId, title, isActive, data }) {
  return ok(
    supabase.from('lists').insert({
      list_id: listId,
      structure_id: structureId,
      user_id: userId,
      title,
      is_active: isActive,
      has_sublists: false,
      data
    }),
    'Could not create the menu'
  )
}

export function upsertList ({ listId, structureId, userId, title, isActive, data }) {
  return ok(
    supabase.from('lists').upsert({
      list_id: listId,
      structure_id: structureId,
      user_id: userId,
      title,
      is_active: isActive,
      has_sublists: false,
      data
    }),
    'Could not save the menu'
  )
}

export function deleteList (listId) {
  return ok(supabase.from('lists').delete().eq('list_id', listId), 'Could not delete the menu')
}
