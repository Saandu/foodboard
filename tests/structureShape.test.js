import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CURRENCY,
  blankStructure,
  defaultDescription,
  normalizeStructure,
  unwrapTabs
} from '../src/structureShape.js'
import { FIELD } from '../src/descriptorFields.js'

/**
 * Rows reach the editor from several eras — seeded demo data, restaurants
 * created by older builds, and rows written today. These are the rules that
 * let the rest of the app assume a complete shape.
 */

describe('unwrapTabs', () => {
  it('leaves a well-formed description alone', () => {
    const description = { label: 'Description', type: 'tabs', tabs: [[{ tabLabel: 'en' }]] }
    expect(unwrapTabs(description)).toBe(description)
  })

  it('recovers tabs saved as a Vue ref wrapper', () => {
    const tabs = [[{ tabLabel: 'en' }]]
    const repaired = unwrapTabs({ tabs: { editableTabs: { value: tabs } } })
    expect(repaired.tabs).toEqual(tabs)
  })

  it('recovers tabs saved one wrapper deep', () => {
    const tabs = [[{ tabLabel: 'it' }]]
    expect(unwrapTabs({ tabs: { editableTabs: tabs } }).tabs).toEqual(tabs)
  })

  it('falls back to an empty list when the wrapper holds nothing usable', () => {
    expect(unwrapTabs({ tabs: { editableTabs: null } }).tabs).toEqual([])
  })
})

describe('normalizeStructure', () => {
  it('fills in every field the editor expects', () => {
    const structure = normalizeStructure({}, 'Trattoria')

    expect(structure.currency).toBe(DEFAULT_CURRENCY)
    expect(structure.language_main).toBe('en')
    expect(structure.color_theme).toBe('light')
    expect(structure.logo).toBe('')
    expect(structure.languages.length).toBeGreaterThan(0)
    expect(structure.description.tabs.length).toBeGreaterThan(0)
  })

  it('keeps values that are already set', () => {
    const structure = normalizeStructure({
      currency: '$',
      language_main: 'ro',
      color_main: '#123456',
      logo: 'uid/111/logo.webp'
    })

    expect(structure.currency).toBe('$')
    expect(structure.language_main).toBe('ro')
    expect(structure.color_main).toBe('#123456')
    expect(structure.logo).toBe('uid/111/logo.webp')
  })

  it('does not mutate the row it was given', () => {
    const source = { currency: '$' }
    normalizeStructure(source)
    expect(source).toEqual({ currency: '$' })
  })

  it('always exposes the five contact fields, empty when absent', () => {
    const { contact } = normalizeStructure({ contact: { phone: '+39 02 0000 1111' } })
    expect(contact).toEqual({
      address: '', phone: '+39 02 0000 1111', email: '', website: '', instagram: ''
    })
  })

  it('replaces a non-object contact rather than trusting it', () => {
    expect(normalizeStructure({ contact: 'nonsense' }).contact.address).toBe('')
  })

  it('survives a row whose structure blob is missing entirely', () => {
    expect(normalizeStructure(null).currency).toBe(DEFAULT_CURRENCY)
  })

  it('repairs a ref-wrapped description on the way through', () => {
    const tabs = [[{ tabLabel: 'en' }, { type: 'text', label: FIELD.STRUCTURE_NAME, value: 'X' }]]
    const structure = normalizeStructure({ description: { tabs: { editableTabs: { value: tabs } } } })
    expect(structure.description.tabs).toEqual(tabs)
  })
})

describe('defaultDescription', () => {
  it('names the restaurant from the row title', () => {
    const [englishTab] = defaultDescription('Caffè Mareluna').tabs
    const name = englishTab.find(field => field.label === FIELD.STRUCTURE_NAME)
    expect(name.value).toBe('Caffè Mareluna')
  })
})

describe('blankStructure', () => {
  it('starts a new restaurant in one language with a complete shape', () => {
    const structure = blankStructure('My restaurant')

    expect(structure.languages).toEqual(['en'])
    expect(structure.description.tabs).toHaveLength(1)
    expect(structure.contact).toEqual({
      address: '', phone: '', email: '', website: '', instagram: ''
    })
  })
})
