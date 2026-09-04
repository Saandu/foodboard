import { supabase } from './supabase.js'

/**
 * Structure logos and record photos.
 *
 * Images live in the public `structure-media` bucket and the structure JSONB
 * stores only the object path. Older records hold a base64 data URL inline;
 * `mediaUrl` resolves both shapes so a workspace keeps rendering until its
 * images have been migrated (see scripts/migrate-images.js).
 */

export const STRUCTURE_MEDIA_BUCKET = 'structure-media'

/** Matches the bucket's file_size_limit in the storage migration. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Matches the bucket's allowed_mime_types. */
const EXTENSION_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
}

export const ACCEPTED_IMAGE_TYPES = Object.keys(EXTENSION_BY_TYPE).join(',')

/** True for a stored object path, false for a legacy data URL or absolute URL. */
export const isStoragePath = (value) =>
  typeof value === 'string' && value !== '' && !/^(data:|blob:|https?:)/i.test(value)

/** Resolves whatever the structure holds into something an `img` can load. */
export const mediaUrl = (value) => {
  if (typeof value !== 'string' || value === '') return ''
  if (!isStoragePath(value)) return value
  return supabase.storage.from(STRUCTURE_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl
}

/**
 * Resolves the photo attached to a record's form descriptor.
 *
 * Records keep their image in a `file` block inside `editModal`: `value` is
 * the Storage path and `active` is the photo's own switch. Returns '' when
 * there is no photo, or when the owner has switched it off — which is
 * separate from the dish being hidden altogether (that is `item.active`).
 */
export const descriptorImage = (editModal) => {
  if (!Array.isArray(editModal)) return ''
  const field = editModal.find(block => block && block.type === 'file')
  if (!field || field.active === false) return ''
  return mediaUrl(field.value)
}

/** Refuse absurd input before spending time decoding it. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024

/**
 * How far each kind of image is allowed to be scaled up to. A logo is shown at
 * ~200px and a dish thumbnail at ~600px, so they get their own budgets rather
 * than one compromise number.
 */
export const IMAGE_PRESETS = {
  logo: { maxEdge: 800, quality: 0.85 },
  dish: { maxEdge: 1200, quality: 0.82 },
  category: { maxEdge: 1200, quality: 0.82 }
}

const DEFAULT_PRESET = { maxEdge: 1200, quality: 0.82 }

/**
 * Scales an image down to fit inside `maxEdge`, preserving aspect ratio.
 * Never scales up: a small image is left at its own size.
 */
export const fitWithin = (width, height, maxEdge) => {
  const longest = Math.max(width, height)
  if (!longest || longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

const canvasToBlob = (canvas, type, quality) =>
  new Promise(resolve => canvas.toBlob(resolve, type, quality))

/**
 * Re-encodes an image as WebP at a sane resolution before it is uploaded.
 *
 * A phone photo is routinely 4–8 MB of JPEG; the same picture at 1200px of
 * WebP is tens of kilobytes, and it is the uploaded bytes that every diner
 * then downloads. Returns the original file whenever conversion would not
 * actually help — animated GIFs (a canvas would flatten them), browsers
 * without WebP encoding, and images that are already smaller.
 */
export const compressImage = async (file, presetName) => {
  const preset = IMAGE_PRESETS[presetName] || DEFAULT_PRESET

  // Flattening an animated GIF to a still frame is worse than leaving it.
  if (!file || file.type === 'image/gif') return file
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (err) {
    console.error('Could not decode the image, uploading it unchanged:', err)
    return file
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, preset.maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)

    const blob = await canvasToBlob(canvas, 'image/webp', preset.quality)
    // Safari used to ignore the requested type and hand back a PNG.
    if (!blob || blob.type !== 'image/webp') return file
    // Re-encoding a small, already-efficient image can make it bigger.
    if (blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], name, { type: 'image/webp' })
  } catch (err) {
    console.error('Could not convert the image, uploading it unchanged:', err)
    return file
  } finally {
    bitmap.close?.()
  }
}

/**
 * Uploads one image and returns its object path.
 *
 * Throws with a translation key so the caller can surface the reason: the
 * editor shows these through `$t()` alongside the other save errors.
 */
export const uploadStructureImage = async (file, { userId, structureId, field }) => {
  if (!file) throw new Error('image_upload_failed')
  if (!userId || !structureId) throw new Error('image_upload_failed')

  // Validate what was chosen, before conversion, so the message names the
  // problem the person can actually see.
  if (!EXTENSION_BY_TYPE[file.type]) throw new Error('image_type_unsupported')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('image_too_large')

  const upload = await compressImage(file, field)

  const extension = EXTENSION_BY_TYPE[upload.type]
  if (!extension) throw new Error('image_type_unsupported')
  // A GIF or an already-small file skips conversion, so it can still be over.
  if (upload.size > MAX_IMAGE_BYTES) throw new Error('image_too_large')

  // The first segment is the owner: the storage policies check it against
  // auth.uid(), so a path outside your own folder is rejected server-side.
  const path = `${userId}/${structureId}/${field}-${Date.now().toString(36)}.${extension}`

  const { error } = await supabase.storage
    .from(STRUCTURE_MEDIA_BUCKET)
    .upload(path, upload, { contentType: upload.type, cacheControl: '31536000', upsert: false })

  if (error) {
    console.error('Error uploading image:', error)
    throw new Error('image_upload_failed')
  }
  return path
}

/**
 * Best-effort removal of stored objects. Legacy data URLs and absolute URLs
 * are skipped: there is nothing in the bucket to delete.
 */
export const removeStructureImages = async (values) => {
  const paths = (Array.isArray(values) ? values : [values]).filter(isStoragePath)
  if (!paths.length) return
  const { error } = await supabase.storage.from(STRUCTURE_MEDIA_BUCKET).remove(paths)
  // A failed cleanup leaves an orphan object, not a broken menu, so it is
  // logged rather than surfaced.
  if (error) console.error('Error removing images:', error)
}

/**
 * Empties a user's whole media folder, used when closing an account.
 *
 * The SQL cascade behind delete_account() cannot do this: Supabase rejects
 * direct deletes on storage.objects, so the blobs have to go through the
 * Storage API while the session still exists.
 */
export const removeAllStructureMedia = async (userId) => {
  if (!userId) return
  const bucket = supabase.storage.from(STRUCTURE_MEDIA_BUCKET)

  // Objects are nested one level deep, at <uid>/<structure_id>/<file>, and
  // list() does not recurse.
  const { data: folders, error } = await bucket.list(userId)
  if (error) {
    console.error('Error listing images:', error)
    return
  }

  const paths = []
  for (const folder of folders || []) {
    const { data: files, error: listError } = await bucket.list(`${userId}/${folder.name}`)
    if (listError) {
      console.error('Error listing images:', listError)
      continue
    }
    for (const file of files || []) paths.push(`${userId}/${folder.name}/${file.name}`)
  }

  if (paths.length) await removeStructureImages(paths)
}
