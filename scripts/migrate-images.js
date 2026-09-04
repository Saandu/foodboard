/**
 * Moves inline base64 images out of structures.structure and into Storage.
 *
 *   npm run migrate:images -- --dry-run   # report only, write nothing
 *   npm run migrate:images
 *
 * Logos used to be stored as data URLs inside the structure JSONB, so every
 * dashboard read pulled the full image down. The editor now uploads to the
 * public `structure-media` bucket and keeps only the object path; this
 * backfills the rows that predate that change.
 *
 * Safe to run more than once: rows already holding a path are skipped.
 * Requires SUPABASE_SERVICE_ROLE_KEY — RLS scopes structures to their owner
 * and the images belong to several accounts.
 */

import { createClient } from '@supabase/supabase-js'
import { loadEnv, requireServiceCredentials } from './env.js'

loadEnv()

const { url, serviceKey } = requireServiceCredentials()

const dryRun = process.argv.includes('--dry-run')

const BUCKET = 'structure-media'
const FIELDS = ['logo']

/** Matches the bucket's allowed_mime_types. */
const EXTENSION_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:')

/** Splits `data:image/png;base64,AAAA` into its mime type and bytes. */
function decodeDataUrl (value) {
  const match = value.match(/^data:([^;,]+)(;base64)?,(.*)$/s)
  if (!match) return null
  const [, contentType, base64Flag, payload] = match
  const buffer = base64Flag
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'binary')
  return { contentType, buffer }
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`

async function main () {
  const { data: structures, error } = await supabase
    .from('structures')
    .select('structure_id, user_id, title, structure')
    .order('structure_id')

  if (error) {
    console.error('Could not read structures:', error.message)
    process.exit(1)
  }

  console.log(`Scanning ${structures.length} structure(s)${dryRun ? ' (dry run)' : ''}…\n`)

  let moved = 0
  let skipped = 0
  let failed = 0

  for (const row of structures) {
    const structure = row.structure || {}
    const pending = FIELDS.filter(field => isDataUrl(structure[field]))

    if (!pending.length) {
      console.log(`  ${row.structure_id} ${row.title}: nothing inline`)
      continue
    }

    let changed = false

    for (const field of pending) {
      const decoded = decodeDataUrl(structure[field])
      if (!decoded) {
        console.warn(`  ${row.structure_id} ${field}: unreadable data URL, left as is`)
        skipped++
        continue
      }

      const extension = EXTENSION_BY_TYPE[decoded.contentType]
      if (!extension) {
        console.warn(`  ${row.structure_id} ${field}: ${decoded.contentType} is not an allowed type, left as is`)
        skipped++
        continue
      }

      // Same layout the editor writes: the owner is the first segment, which
      // is what the storage policies check.
      const path = `${row.user_id}/${row.structure_id}/${field}-${Date.now().toString(36)}.${extension}`

      if (dryRun) {
        console.log(`  ${row.structure_id} ${field}: would upload ${kb(decoded.buffer.length)} to ${path}`)
        moved++
        continue
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, decoded.buffer, {
          contentType: decoded.contentType,
          cacheControl: '31536000',
          upsert: true
        })

      if (uploadError) {
        console.error(`  ${row.structure_id} ${field}: upload failed — ${uploadError.message}`)
        failed++
        continue
      }

      structure[field] = path
      changed = true
      moved++
      console.log(`  ${row.structure_id} ${field}: ${kb(decoded.buffer.length)} → ${path}`)
    }

    if (changed && !dryRun) {
      const { error: updateError } = await supabase
        .from('structures')
        .update({ structure })
        .eq('structure_id', row.structure_id)

      if (updateError) {
        // The objects are uploaded but the row still points at the data URL.
        // Re-running is safe and will simply upload them again.
        console.error(`  ${row.structure_id}: row update failed — ${updateError.message}`)
        failed++
      }
    }
  }

  console.log(`\n${dryRun ? 'Would move' : 'Moved'} ${moved} image(s). Skipped ${skipped}. Failed ${failed}.`)
  if (failed) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
