/* ------------------------------------------------------------------ *
 * Storage-shape builders
 *
 * The admin panel stores each editable record as a "modal descriptor":
 * an array of form-field definitions, with one localised tab per language.
 * The customer menu reads translations straight back out of that structure.
 * These helpers build that shape from the flat content in demo-data.js.
 *
 * They are pure and side-effect free — kept in their own module so the test
 * suite can import them without seed.js reaching for credentials.
 * ------------------------------------------------------------------ */

/** Language tab order. Keep in sync with `tabs` in src/stores/store.js —
 *  a language missing here gets no editable tab in the admin panel. */
export const LANGS = ['it', 'en', 'ro', 'es', 'de', 'fr', 'ru', 'zh', 'ja']

/** `value` holds a Storage object path (older records hold a data URL).
 *  `active` is the photo's own switch — dish visibility is item.active. */
export const PHOTO_FIELD = {
  type: 'file',
  label: 'Foto',
  value: '',
  active: true,
  accept: 'image/png,image/jpeg,image/gif,image/webp'
}

/** Reads a localised value, defaulting to an empty string for untranslated languages. */
export const t = (field, lang) => (field && field[lang]) || ''

/** Wraps per-language field rows into the `tabs` descriptor the admin renders. */
export const tabsBlock = (buildRow, label = 'Name') => ({
  type: 'tabs',
  label,
  tabs: LANGS.map(lang => [{ tabLabel: lang }, ...buildRow(lang)])
})

export const productRow = (item) => (lang) => [
  { type: 'text', label: 'Titolo', value: t(item.title, lang) },
  { type: 'description_rows', value: [{ type: 'text', value: t(item.description, lang) }] },
  {
    type: 'prices',
    value: [{ type: 'text', value: item.price || '', suffix: t(item.priceSuffix, lang) }]
  },
  { type: 'text', label: 'Titolo per descrizione aggiuntiva (Facoltativo)', value: '' },
  { type: 'text', label: 'Descrizione aggiuntiva (Facoltativo)', value: '' },
  { type: 'text', label: 'Titolo per dettagli (Facoltativo)', value: '' },
  { type: 'text', label: 'Dettagli aggiuntivi (Facoltativo) ', value: '' }
]

export const divisorRow = (item) => (lang) => [
  { type: 'text', label: 'Titolo', value: t(item.title, lang) }
]

export const categoryRow = (category) => (lang) => [
  { type: 'text', label: 'Titolo', value: t(category.name, lang) },
  { type: 'text', label: 'Descrizione', value: t(category.description, lang) },
  { ...PHOTO_FIELD }
]

export const listRow = (list) => (lang) => [
  { type: 'text', label: 'Titolo', value: t(list.name, lang) }
]

/** The main language's value, used for the plain-text `name` column. */
export const displayName = (field, mainLang) => t(field, mainLang) || t(field, 'en') || ''

export function buildProduct (item, mainLang) {
  const isDivisor = item.type === 'divisor'

  return {
    name: displayName(item.title, mainLang),
    type: isDivisor ? 'divisor' : 'product',
    image: { id: 20, url: 'URL img', active: true },
    editModal: isDivisor
      ? [tabsBlock(divisorRow(item))]
      : [
        tabsBlock(productRow(item)),
        { ...PHOTO_FIELD },
        { type: 'allergens', label: 'Allergens', value: item.allergens || [] }
      ]
  }
}

export function buildCategory (category, mainLang) {
  return {
    name: displayName(category.name, mainLang),
    image: { id: 20, url: 'URL img', active: false },
    pages: 1,
    active: true,
    category_id: category.category_id,
    editModal: [tabsBlock(categoryRow(category))]
  }
}

/* Blank templates cloned by the admin's "add" buttons. Seeding these fixes the
 * previously empty Add Category / Add List modals. */
export const blankProductModal = () => [
  tabsBlock(productRow({})),
  { ...PHOTO_FIELD },
  { type: 'allergens', label: 'Allergens', value: [] }
]
export const blankDivisorModal = () => [tabsBlock(divisorRow({}))]
export const blankCategoryModal = () => [tabsBlock(categoryRow({}))]
export const blankListModal = () => [tabsBlock(listRow({}))]
