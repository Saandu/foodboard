import { describe, expect, it } from 'vitest'
import { fieldValue, hasContent, tabFor } from '../src/menuTranslations.js'

/**
 * The published menu renders whatever the editor saved, and the editor lets an
 * owner translate a dish into some languages and not others. These tests pin
 * down what a diner sees in the gaps.
 */

const tab = (lang, fields = []) => [{ tabLabel: lang }, ...fields]
const text = (label, value) => ({ type: 'text', label, value })

describe('hasContent', () => {
  it('is false for a tab whose fields are all blank', () => {
    expect(hasContent(tab('it', [text('Titolo', '')]))).toBe(false)
  })

  it('is true as soon as one field carries text', () => {
    expect(hasContent(tab('it', [text('Titolo', 'Cozze')]))).toBe(true)
  })

  it('is false for anything that is not a tab array', () => {
    expect(hasContent(undefined)).toBe(false)
    expect(hasContent(null)).toBe(false)
    expect(hasContent({})).toBe(false)
  })
})

describe('tabFor', () => {
  const tabs = [
    tab('it', [text('Titolo', 'Cozze alla marinara')]),
    tab('en', [text('Titolo', 'Mussels marinara')]),
    tab('ro', [text('Titolo', '')])
  ]

  it('returns the requested language when it is translated', () => {
    expect(fieldValue(tabFor(tabs, 'en'), 'Titolo')).toBe('Mussels marinara')
  })

  it('falls back to the first populated tab when the language is blank', () => {
    // 'ro' exists but was never filled in, so the diner gets Italian rather
    // than an empty line.
    expect(fieldValue(tabFor(tabs, 'ro'), 'Titolo')).toBe('Cozze alla marinara')
  })

  it('falls back to the first populated tab when the language is absent', () => {
    expect(fieldValue(tabFor(tabs, 'ja'), 'Titolo')).toBe('Cozze alla marinara')
  })

  it('returns the first tab when nothing anywhere is translated', () => {
    const blank = [tab('it', [text('Titolo', '')]), tab('en', [text('Titolo', '')])]
    expect(tabFor(blank, 'en')).toBe(blank[0])
  })

  it('returns null for a record with no tabs at all', () => {
    expect(tabFor([], 'it')).toBeNull()
    expect(tabFor(undefined, 'it')).toBeNull()
    expect(tabFor(null, 'it')).toBeNull()
  })

  it('does not confuse a tab label with a field label', () => {
    // The tabLabel marker has no `label`, so it must never be picked up here.
    expect(fieldValue(tabFor(tabs, 'it'), 'tabLabel')).toBe('')
  })
})

describe('fieldValue', () => {
  const populated = tab('it', [text('Titolo', 'Crudo di ricciola'), text('Descrizione', 'Con agrumi')])

  it('reads a labelled field', () => {
    expect(fieldValue(populated, 'Descrizione')).toBe('Con agrumi')
  })

  it('returns an empty string for a label the record does not carry', () => {
    expect(fieldValue(populated, 'Allergeni')).toBe('')
  })

  it('returns an empty string rather than throwing on a missing tab', () => {
    expect(fieldValue(null, 'Titolo')).toBe('')
    expect(fieldValue(undefined, 'Titolo')).toBe('')
  })

  it('normalises a null value to an empty string', () => {
    expect(fieldValue(tab('it', [{ type: 'text', label: 'Titolo', value: null }]), 'Titolo')).toBe('')
  })
})
