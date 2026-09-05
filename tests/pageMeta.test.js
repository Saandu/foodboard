import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { menuPageMeta, resetPageLanguage, setBaseLanguage, setPageLanguage } from '../src/pageMeta.js'

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

/**
 * <html lang> has to track two different languages: the dashboard's interface
 * locale, and the language a published menu is actually written in — which the
 * dashboard may not even be translated into. Getting this wrong is not
 * cosmetic; it is what a screen reader takes its pronunciation from.
 *
 * A stub document is enough here: the module reads `document` when called, not
 * when imported, so no DOM implementation is needed to test the sequencing.
 */
describe('document language', () => {
  let attributes

  beforeEach(() => {
    attributes = {}
    globalThis.document = {
      documentElement: { setAttribute: (name, value) => { attributes[name] = value } }
    }
  })

  afterEach(() => { delete globalThis.document })

  it('applies the interface locale', () => {
    setBaseLanguage('ro')
    expect(attributes.lang).toBe('ro')
  })

  it('lets a menu override it, then puts the interface locale back', () => {
    setBaseLanguage('ro')
    setPageLanguage('ja')
    expect(attributes.lang).toBe('ja')

    resetPageLanguage()
    expect(attributes.lang).toBe('ro')
  })

  it('falls back to the interface locale when a menu has no language', () => {
    setBaseLanguage('it')
    setPageLanguage('')
    expect(attributes.lang).toBe('it')
  })

  it('defaults to English rather than clearing the attribute', () => {
    setBaseLanguage(undefined)
    expect(attributes.lang).toBe('en')
  })
})
