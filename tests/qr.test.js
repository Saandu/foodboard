import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'

/**
 * The share flow used to fetch its QR image from api.qrserver.com. It is now
 * drawn locally, so this checks the encoder actually produces a usable PNG for
 * the kind of link the dashboard builds.
 */

const menuLink = 'https://foodboard-demo.web.app/menu/trattoria-mareluna'

describe('QR generation', () => {
  it('returns a PNG data URL', async () => {
    const dataUrl = await QRCode.toDataURL(menuLink, { width: 520, margin: 2 })
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    // A blank or truncated image would still match the prefix.
    expect(dataUrl.length).toBeGreaterThan(1000)
  })

  it('encodes into a real symbol grid rather than an empty canvas', async () => {
    const grid = await QRCode.toString(menuLink, { type: 'utf8' })
    const rows = grid.split('\n').filter(Boolean)
    // A QR symbol is square and at least 21 modules across; the utf8 renderer
    // packs two module rows into each text row.
    expect(rows.length).toBeGreaterThan(10)
    expect(rows.some(row => /[█▀▄]/.test(row))).toBe(true)
  })

  it('is deterministic, so reopening the modal does not redraw differently', async () => {
    const options = { width: 520, margin: 2, errorCorrectionLevel: 'M' }
    const [first, second] = await Promise.all([
      QRCode.toDataURL(menuLink, options),
      QRCode.toDataURL(menuLink, options)
    ])
    expect(first).toBe(second)
  })

  it('produces a different code for a rotated slug', async () => {
    const rotated = 'https://foodboard-demo.web.app/menu/9f2c4d44410e4f83b46694'
    const [before, after] = await Promise.all([
      QRCode.toDataURL(menuLink),
      QRCode.toDataURL(rotated)
    ])
    expect(before).not.toBe(after)
  })

  it('rejects nothing a menu link can contain', async () => {
    // Long random slugs are the default shape, so the encoder must cope.
    const long = `https://foodboard-demo.web.app/menu/${'a'.repeat(22)}`
    await expect(QRCode.toDataURL(long)).resolves.toContain('data:image/png;base64,')
  })
})
