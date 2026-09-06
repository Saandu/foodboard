// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The upload conversion ladder.
 *
 * Uploaded bytes are the bytes every diner then downloads, so the encoder does
 * not stop at "smaller than the original" — it keeps stepping quality down
 * until the result is under the preset's target. These tests stand in a fake
 * canvas for the real one: happy-dom has no WebP encoder, and what is worth
 * asserting is the decision-making, not the codec.
 */

vi.mock('../src/supabase.js', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } }
}))

const { compressImage, IMAGE_PRESETS } = await import('../src/media.js')

const KB = 1024

/**
 * Stands in a canvas whose encoder returns `sizeFor(quality)` bytes, and
 * records every quality it was asked for.
 */
const stubCanvas = (sizeFor) => {
  const qualities = []
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag !== 'canvas') return document.createElement.wrappedMethod?.call(document, tag) ?? {}
    return {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (done, type, quality) => {
        qualities.push(Number(quality.toFixed(4)))
        done(new Blob([new Uint8Array(sizeFor(quality))], { type: 'image/webp' }))
      }
    }
  })
  return qualities
}

const sourceFile = (bytes = 4000 * KB) =>
  new File([new Uint8Array(bytes)], 'dish.jpg', { type: 'image/jpeg' })

globalThis.createImageBitmap = async () => ({ width: 3000, height: 2000, close () {} })

afterEach(() => vi.restoreAllMocks())

describe('compressImage', () => {
  it('stops at the first quality that meets the target', async () => {
    const qualities = stubCanvas(() => 100 * KB)
    const out = await compressImage(sourceFile(), 'dish')

    expect(qualities).toEqual([IMAGE_PRESETS.dish.quality])
    expect(out.type).toBe('image/webp')
    expect(out.name).toBe('dish.webp')
  })

  it('steps quality down while the encode is still over target', async () => {
    // Only the third step gets under the dish target of 220 KB.
    const sizes = { 0.82: 600 * KB, 0.7: 300 * KB, 0.57: 180 * KB }
    const qualities = stubCanvas(q => sizes[Number(q.toFixed(2))] ?? 900 * KB)

    const out = await compressImage(sourceFile(), 'dish')

    expect(qualities).toHaveLength(3)
    expect(out.size).toBe(180 * KB)
  })

  it('never goes below the quality floor, and keeps the smallest it managed', async () => {
    const qualities = stubCanvas(() => 400 * KB) // never reaches target
    const out = await compressImage(sourceFile(), 'logo')

    expect(Math.min(...qualities)).toBeGreaterThanOrEqual(0.55)
    expect(out.size).toBe(400 * KB)
    expect(out.type).toBe('image/webp')
  })

  it('uploads the original rather than a re-encode that came out larger', async () => {
    stubCanvas(() => 900 * KB)
    const original = sourceFile(500 * KB)

    await expect(compressImage(original, 'dish')).resolves.toBe(original)
  })

  it('abandons the ladder when the browser will not produce WebP', async () => {
    const qualities = []
    vi.spyOn(document, 'createElement').mockImplementation(() => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (done, type, quality) => {
        qualities.push(quality)
        done(new Blob([new Uint8Array(10)], { type: 'image/png' }))
      }
    }))

    const original = sourceFile()
    await expect(compressImage(original, 'dish')).resolves.toBe(original)
    expect(qualities, 'a lower quality would still be a PNG').toHaveLength(1)
  })

  it('leaves an animated GIF alone', async () => {
    const gif = new File([new Uint8Array(10)], 'spin.gif', { type: 'image/gif' })
    await expect(compressImage(gif, 'dish')).resolves.toBe(gif)
  })
})
