import { describe, expect, it } from 'vitest'
import { menuPageMeta } from '../src/pageMeta.js'

/**
 * A published menu is the product's shareable surface. Whatever ends up in the
 * tab, a bookmark and Google's index should name the restaurant, not the tool
 * that built it.
 */

describe('menuPageMeta', () => {
  it('names the restaurant and the menu', () => {
    const meta = menuPageMeta({ restaurant: 'Trattoria Mareluna', menu: 'Menù della Sera' })
    expect(meta.title).toBe('Trattoria Mareluna — Menù della Sera')
  })

  it('falls back to the restaurant alone when the menu is untitled', () => {
    expect(menuPageMeta({ restaurant: 'Caffè Mareluna' }).title).toBe('Caffè Mareluna')
  })

  it('prefers the published description', () => {
    const meta = menuPageMeta({ restaurant: 'X', profile: 'Wine bar', description: 'Sea and land cooking.' })
    expect(meta.description).toBe('Sea and land cooking.')
  })

  it('falls back to the business profile, then to a generated line', () => {
    expect(menuPageMeta({ restaurant: 'X', profile: 'Wine bar' }).description).toBe('Wine bar')
    expect(menuPageMeta({ restaurant: 'X' }).description).toContain('X')
  })

  it('never produces an empty title', () => {
    expect(menuPageMeta({}).title).toBeTruthy()
    expect(menuPageMeta({ restaurant: '' }).title).toBeTruthy()
  })
})
