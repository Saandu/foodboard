import { describe, expect, it } from 'vitest'
import {
  LANGS,
  blankCategoryModal,
  blankListModal,
  blankProductModal,
  buildCategory,
  buildProduct,
  displayName,
  tabsBlock,
  t
} from '../scripts/shapes.js'
import { tabFor, fieldValue } from '../src/menuTranslations.js'

/**
 * These builders encode the JSONB contract the whole app reads back: the
 * dashboard renders these descriptors as forms and the public menu resolves
 * translations out of them. A change here silently reshapes stored data, so
 * the shape is asserted rather than assumed.
 */

const dish = {
  title: { it: 'Cozze alla marinara', en: 'Mussels marinara' },
  description: { it: 'Cozze di Olbia', en: 'Olbia mussels' },
  price: '14.00',
  priceSuffix: { it: 'al kg', en: 'per kg' },
  allergens: ['1', '6']
}

describe('t', () => {
  it('reads the requested language', () => {
    expect(t(dish.title, 'en')).toBe('Mussels marinara')
  })

  it('returns an empty string for an untranslated language', () => {
    expect(t(dish.title, 'ja')).toBe('')
  })

  it('tolerates a missing field entirely', () => {
    expect(t(undefined, 'it')).toBe('')
  })
})

describe('displayName', () => {
  it('prefers the main language', () => {
    expect(displayName(dish.title, 'it')).toBe('Cozze alla marinara')
  })

  it('falls back to English when the main language is untranslated', () => {
    expect(displayName(dish.title, 'de')).toBe('Mussels marinara')
  })

  it('returns an empty string when neither exists', () => {
    expect(displayName({ ro: 'Midii' }, 'de')).toBe('')
  })
})

describe('tabsBlock', () => {
  const block = tabsBlock(() => [{ type: 'text', label: 'Titolo', value: 'x' }])

  it('emits one tab per supported language, in order', () => {
    expect(block.tabs).toHaveLength(LANGS.length)
    expect(block.tabs.map(tab => tab[0].tabLabel)).toEqual(LANGS)
  })

  it('puts the tabLabel marker first in every tab', () => {
    for (const tab of block.tabs) expect(Object.keys(tab[0])).toEqual(['tabLabel'])
  })

  it('defaults its label but allows an override', () => {
    expect(block.label).toBe('Name')
    expect(tabsBlock(() => [], 'Titolo').label).toBe('Titolo')
  })
})

describe('buildProduct', () => {
  const product = buildProduct(dish, 'it')

  it('names the row in the main language for the plain-text column', () => {
    expect(product.name).toBe('Cozze alla marinara')
    expect(product.type).toBe('product')
  })

  it('produces a descriptor the public menu can read back', () => {
    // This is the contract CustomerMenu.vue depends on, exercised through the
    // same resolvers the page uses.
    const tabs = product.editModal[0].tabs
    expect(fieldValue(tabFor(tabs, 'en'), 'Titolo')).toBe('Mussels marinara')
    expect(fieldValue(tabFor(tabs, 'it'), 'Titolo')).toBe('Cozze alla marinara')
  })

  it('carries the price on every tab with a per-language suffix', () => {
    const byLang = Object.fromEntries(product.editModal[0].tabs.map(tab => [
      tab[0].tabLabel,
      tab.find(field => field.type === 'prices').value[0]
    ]))
    expect(byLang.it).toEqual({ type: 'text', value: '14.00', suffix: 'al kg' })
    expect(byLang.en).toEqual({ type: 'text', value: '14.00', suffix: 'per kg' })
    // Untranslated languages keep the price and drop the suffix.
    expect(byLang.ja).toEqual({ type: 'text', value: '14.00', suffix: '' })
  })

  it('attaches allergens once, outside the language tabs', () => {
    const allergens = product.editModal.filter(field => field.type === 'allergens')
    expect(allergens).toHaveLength(1)
    expect(allergens[0].value).toEqual(['1', '6'])
  })

  it('defaults allergens to an empty list', () => {
    const plain = buildProduct({ title: { it: 'Pane' } }, 'it')
    expect(plain.editModal.find(field => field.type === 'allergens').value).toEqual([])
  })

  it('builds a divisor as a title-only row with no photo or allergens', () => {
    const divisor = buildProduct({ type: 'divisor', title: { it: 'Dal mare' } }, 'it')
    expect(divisor.type).toBe('divisor')
    expect(divisor.editModal).toHaveLength(1)
    expect(fieldValue(tabFor(divisor.editModal[0].tabs, 'it'), 'Titolo')).toBe('Dal mare')
  })

  it('gives each product its own photo field rather than a shared reference', () => {
    const a = buildProduct(dish, 'it')
    const b = buildProduct(dish, 'it')
    const photoA = a.editModal.find(field => field.type === 'file')
    const photoB = b.editModal.find(field => field.type === 'file')
    expect(photoA).not.toBe(photoB)
    photoA.value = 'changed'
    expect(photoB.value).toBe('')
  })
})

describe('buildCategory', () => {
  const category = buildCategory({
    category_id: 'cat-1',
    name: { it: 'Antipasti', en: 'Starters' },
    description: { it: 'Da condividere', en: 'To share' }
  }, 'it')

  it('keeps the category id so products can be joined to it', () => {
    expect(category.category_id).toBe('cat-1')
  })

  it('is active by default', () => {
    expect(category.active).toBe(true)
  })

  it('exposes its name and description per language', () => {
    const tabs = category.editModal[0].tabs
    expect(category.name).toBe('Antipasti')
    expect(fieldValue(tabFor(tabs, 'en'), 'Titolo')).toBe('Starters')
    expect(fieldValue(tabFor(tabs, 'en'), 'Descrizione')).toBe('To share')
  })
})

describe('blank "add" templates', () => {
  // The dashboard clones these when the owner adds a record. An empty array
  // here is what used to leave the Add Category / Add List modals blank.
  const templates = {
    product: blankProductModal(),
    category: blankCategoryModal(),
    list: blankListModal()
  }

  it('are never empty', () => {
    for (const [name, template] of Object.entries(templates)) {
      expect(template.length, `${name} template`).toBeGreaterThan(0)
    }
  })

  it('carry a full set of language tabs with no prefilled text', () => {
    for (const [name, template] of Object.entries(templates)) {
      const block = template.find(field => field.type === 'tabs')
      expect(block, `${name} template`).toBeDefined()
      expect(block.tabs).toHaveLength(LANGS.length)
      for (const tab of block.tabs) {
        for (const field of tab.slice(1)) {
          if (typeof field.value === 'string') expect(field.value).toBe('')
        }
      }
    }
  })

  it('return a fresh object each call, so edits do not leak between records', () => {
    const first = blankCategoryModal()
    first[0].tabs[0][1].value = 'typed by the owner'
    expect(blankCategoryModal()[0].tabs[0][1].value).toBe('')
  })
})
