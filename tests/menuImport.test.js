import { describe, expect, it } from 'vitest'
import { buildMenuRecords } from '../supabase/functions/_shared/menu-records.js'
import { currencyMatches, detectMime, normalizeAmount, parseGeminiResponse, readBoundedBody, repairDraft, validateDraft } from '../supabase/functions/_shared/menu-import.js'
import { fieldValue, tabFor } from '../src/menuTranslations.js'

export const fixture = () => ({
  title: 'Meniu de prânz', language: 'ro', currency: 'RON', warnings: [],
  categories: [{ name: 'Paste', description: '', items: [{
    name: 'Paste cu roșii', description: 'Roșii și busuioc',
    prices: [{ amount: '35.50', label: 'Mică' }, { amount: '49', label: 'Mare' }],
    allergens: [6], warning: ''
  }] }]
})

describe('untrusted menu extraction', () => {
  it('preserves source text, multiple prices and explicitly declared allergens', () => {
    const input = fixture()
    expect(validateDraft(input)).toEqual(input)
    expect(input.categories[0].items[0].prices).toHaveLength(2)
  })
  it.each(['€35', '35,50', '-1', '1e5', 'NaN'])('rejects ambiguous or unsafe price %s', amount => {
    const input = fixture()
    input.categories[0].items[0].prices[0].amount = amount
    expect(() => validateDraft(input)).toThrow('invalid_prices')
  })
  it('allows unresolved extraction prices for review but rejects invalid allergen IDs', () => {
    const input = fixture()
    input.categories[0].items[0].prices[0].amount = ''
    expect(validateDraft(input).categories[0].items[0].prices[0].amount).toBe('')
    input.categories[0].items[0].allergens = [15]
    expect(() => validateDraft(input)).toThrow('invalid_allergens')
  })
  it('rejects empty, oversized and unsupported language menus', () => {
    expect(() => validateDraft({ ...fixture(), categories: [] })).toThrow()
    expect(() => validateDraft({ ...fixture(), language: 'xx' })).toThrow()
    const input = fixture()
    input.categories[0].items = Array.from({ length: 151 }, () => input.categories[0].items[0])
    expect(() => validateDraft(input)).toThrow('too_many_items')
  })
  it('rejects truncated output, blocked responses and invalid JSON', () => {
    expect(() => parseGeminiResponse({ candidates: [{ finishReason: 'MAX_TOKENS' }] })).toThrow('extraction_incomplete')
    expect(() => parseGeminiResponse({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow()
    expect(() => parseGeminiResponse({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] })).toThrow('invalid_extraction')
    expect(parseGeminiResponse({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'reasoning' }, { text: JSON.stringify(fixture()) }] } }] })).toEqual(fixture())
  })
  it('checks binary signatures rather than trusting filename or MIME headers', () => {
    expect(detectMime(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf')
    expect(detectMime(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png')
    expect(detectMime(Uint8Array.from([255, 216, 255]))).toBe('image/jpeg')
    expect(() => detectMime(new TextEncoder().encode('<script>'))).toThrow('unsupported_file')
  })
  it('bounds streamed bodies even when Content-Length is missing or lies', async () => {
    const request = new Request('https://example.test', { method: 'POST', body: new Uint8Array(12) })
    await expect(readBoundedBody(request, 10)).rejects.toThrow('file_too_large')
    expect(await readBoundedBody(new Request('https://example.test', { method: 'POST', body: 'abc' }), 10)).toEqual(new TextEncoder().encode('abc'))
  })
  it('compares symbols to ISO codes without converting money', () => {
    expect(currencyMatches('EUR', '€')).toBe(true)
    expect(currencyMatches('RON', '€')).toBe(false)
    expect(currencyMatches('', 'RON')).toBe(true)
  })
})

describe('FoodBoard storage conversion', () => {
  it('uses correct linked IDs and saves an unpublished menu with editable descriptors', () => {
    let sequence = 0
    const records = buildMenuRecords(fixture(), 'restaurant', 'owner', () => `id-${sequence++}`)
    expect(records.list.is_active).toBe(false)
    expect(records.list.data.active).toBe(false)
    expect(records.list.data.count).toBe(1)
    expect(records.categories.list_id).toBe(records.list.list_id)
    const category = records.categories.category.categories[0]
    expect(category.category_id).toBe(records.products[0].category_id)
    expect(records.products[0].user_id).toBe('owner')
    const item = records.products[0].product.products[0]
    expect(fieldValue(tabFor(item.editModal[0].tabs, 'ro'), 'Titolo')).toBe('Paste cu roșii')
    expect(fieldValue(tabFor(item.editModal[0].tabs, 'en'), 'Titolo')).toBe('Paste cu roșii')
    expect(item.editModal.find(field => field.type === 'allergens').value).toEqual(['6'])
    expect(tabFor(item.editModal[0].tabs, 'ro').find(field => field.type === 'prices').value).toEqual([
      { type: 'text', value: '35.50', suffix: 'Mică' }, { type: 'text', value: '49', suffix: 'Mare' }
    ])
    expect(records.products[0].product.addProductModal).not.toHaveLength(0)
  })

  it('repairs imperfect model output instead of discarding the extraction', () => {
    const item = (extra = {}) => ({ name: 'Pasta', description: '', prices: [{ amount: '12.50', label: '' }], allergens: [], warning: '', ...extra })
    const draft = repairDraft({
      title: '',
      language: 'xx',
      currency: 'EUR',
      categories: [
        { name: 'Mains', description: '', items: [item({ prices: [{ amount: '12,50', label: '' }] }), item({ prices: [{ amount: 'S.Q.', label: '' }] }), item({ allergens: ['gluten', 'Milk', 15, 'shellfish', 6] }), item({ prices: Array(7).fill({ amount: '9', label: 'x' }) }), item({ name: 'x'.repeat(200) })] },
        { name: 'Drinks', description: '', items: [] }
      ]
    })
    expect(draft.title).toBe('Imported menu')
    expect(draft.language).toBe('en')
    expect(draft.categories).toHaveLength(1)
    const [comma, unreadable, allergens, sizes, long] = draft.categories[0].items
    expect(comma.prices[0].amount).toBe('12.50')
    expect(unreadable.prices[0].amount).toBe('')
    expect(unreadable.warning).toMatch(/could not be read/)
    expect(allergens.allergens).toEqual([6, 14])
    expect(sizes.prices).toHaveLength(6)
    expect(long.name).toHaveLength(120)
    expect(() => repairDraft({ title: 'Flyer', language: 'en', currency: '', categories: [] })).toThrow('not_a_menu')
  })
  it('normalizes European, symbol and thousands-separated amounts', () => {
    expect(['12,50', '€ 9', '1.250,00', '1,250.00', '12.500', '12.345.678', 'free'].map(normalizeAmount)).toEqual(['12.50', '9', '1250.00', '1250.00', '', '', ''])
  })
  it('matches Romanian lei to RON', () => {
    expect(currencyMatches('RON', 'lei')).toBe(true)
    expect(currencyMatches('lei', 'lei')).toBe(true)
    expect(currencyMatches('RON', '€')).toBe(false)
  })
})
