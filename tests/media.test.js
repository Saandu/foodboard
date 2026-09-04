import { describe, expect, it, vi } from 'vitest'

// supabase.js throws without VITE_ credentials and would open a real client,
// so the module is stubbed down to the one storage call mediaUrl makes.
vi.mock('../src/supabase.js', () => ({
  supabase: {
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path) => ({
          data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` }
        })
      })
    }
  }
}))

const { descriptorImage, fitWithin, isStoragePath, mediaUrl, STRUCTURE_MEDIA_BUCKET } = await import('../src/media.js')

/**
 * Images moved from inline base64 to Storage paths. Both shapes have to keep
 * rendering: rows written before the move still hold a data URL until
 * scripts/migrate-images.js has run against them.
 */

describe('isStoragePath', () => {
  it('recognises a stored object path', () => {
    expect(isStoragePath('5519f9b7-ee41/111/logo-m4k2p9.jpg')).toBe(true)
  })

  it('rejects the shapes that are already loadable as-is', () => {
    expect(isStoragePath('data:image/jpeg;base64,/9j/4AAQ')).toBe(false)
    expect(isStoragePath('https://cdn.example.com/logo.png')).toBe(false)
    expect(isStoragePath('http://cdn.example.com/logo.png')).toBe(false)
    expect(isStoragePath('blob:http://localhost/9f2c')).toBe(false)
  })

  it('is case-insensitive about the scheme', () => {
    expect(isStoragePath('DATA:image/png;base64,AAAA')).toBe(false)
    expect(isStoragePath('HTTPS://cdn.example.com/logo.png')).toBe(false)
  })

  it('rejects empty and non-string input', () => {
    expect(isStoragePath('')).toBe(false)
    expect(isStoragePath(undefined)).toBe(false)
    expect(isStoragePath(null)).toBe(false)
    expect(isStoragePath(42)).toBe(false)
  })
})

describe('mediaUrl', () => {
  it('resolves a storage path against the public bucket', () => {
    expect(mediaUrl('uid/111/logo-abc.jpg'))
      .toBe(`https://example.supabase.co/storage/v1/object/public/${STRUCTURE_MEDIA_BUCKET}/uid/111/logo-abc.jpg`)
  })

  it('passes a legacy data URL through untouched', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg'
    expect(mediaUrl(dataUrl)).toBe(dataUrl)
  })

  it('passes an absolute URL through untouched', () => {
    expect(mediaUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png')
  })

  it('returns an empty string for an unset image', () => {
    // The editor stores '' for "no logo", and the templates test that value.
    expect(mediaUrl('')).toBe('')
    expect(mediaUrl(undefined)).toBe('')
    expect(mediaUrl(null)).toBe('')
  })
})

describe('descriptorImage', () => {
  const withPhoto = (extra = {}) => [
    { type: 'tabs', tabs: [] },
    { type: 'file', label: 'Foto', value: 'uid/111/dish-abc.webp', active: true, ...extra },
    { type: 'allergens', value: [] }
  ]

  it('resolves the photo held on a record descriptor', () => {
    expect(descriptorImage(withPhoto()))
      .toContain(`/${STRUCTURE_MEDIA_BUCKET}/uid/111/dish-abc.webp`)
  })

  it('returns nothing when the owner switched the photo off', () => {
    // Distinct from hiding the dish itself, which is item.active.
    expect(descriptorImage(withPhoto({ active: false }))).toBe('')
  })

  it('treats a missing active flag as shown, for records predating the switch', () => {
    expect(descriptorImage(withPhoto({ active: undefined }))).not.toBe('')
  })

  it('returns nothing when no photo has been chosen', () => {
    expect(descriptorImage(withPhoto({ value: '' }))).toBe('')
  })

  it('returns nothing for a record with no file block, like a divisor', () => {
    expect(descriptorImage([{ type: 'tabs', tabs: [] }])).toBe('')
  })

  it('survives a malformed descriptor', () => {
    expect(descriptorImage(undefined)).toBe('')
    expect(descriptorImage(null)).toBe('')
    expect(descriptorImage([null, undefined])).toBe('')
  })

  it('still resolves a legacy inline photo', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQ'
    expect(descriptorImage([{ type: 'file', value: dataUrl, active: true }])).toBe(dataUrl)
  })
})

describe('fitWithin', () => {
  it('leaves an image that already fits alone', () => {
    expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 })
  })

  it('scales the long edge down to the budget, keeping the ratio', () => {
    expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 })
  })

  it('works when height is the long edge', () => {
    expect(fitWithin(3000, 4000, 1200)).toEqual({ width: 900, height: 1200 })
  })

  it('never rounds a dimension away to zero', () => {
    const { width, height } = fitWithin(4000, 3, 1200)
    expect(width).toBe(1200)
    expect(height).toBeGreaterThanOrEqual(1)
  })

  it('tolerates a zero-sized image rather than dividing by it', () => {
    expect(fitWithin(0, 0, 1200)).toEqual({ width: 0, height: 0 })
  })
})
