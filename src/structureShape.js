/**
 * Defaults and repairs for the `structures.structure` JSONB blob.
 *
 * Rows reach the editor from several eras: seeded demo data, restaurants
 * created by older builds, and rows written by the current one. Rather than
 * guarding every property at every read site, everything loaded is passed
 * through `normalizeStructure` once so the rest of the app can assume the
 * shape is complete.
 *
 * Pure on purpose — no store, no network — so the rules are unit-testable.
 */

import { BLOCK, FIELD } from './descriptorFields.js'

export const DEFAULT_COLOR_MAIN = '#292a2b'
export const DEFAULT_COLOR_BACKGROUND = '#ffffff'
export const DEFAULT_CURRENCY = '€'
export const DEFAULT_LANGUAGES = ['en', 'it', 'ro']

const CONTACT_FIELDS = ['address', 'phone', 'email', 'website', 'instagram']

/**
 * Unwraps a description whose tabs were saved as a Vue ref rather than a
 * plain array.
 *
 * An older editor build passed the reactive wrapper straight to the database,
 * so those rows hold `{ editableTabs: { value: [...] } }` where an array
 * belongs. Repairing on load means the next save writes the correct shape and
 * the row heals itself.
 */
export function unwrapTabs (description) {
  if (!description?.tabs || Array.isArray(description.tabs)) return description
  const wrapped = description.tabs.editableTabs
  const tabs = Array.isArray(wrapped)
    ? wrapped
    : Array.isArray(wrapped?.value)
      ? wrapped.value
      : []
  return { ...description, tabs }
}

/** A description block for a restaurant that has none, in one language. */
function descriptionTab (lang, { name, profile, blurb }) {
  return [
    { tabLabel: lang },
    { type: BLOCK.TEXT, label: FIELD.STRUCTURE_NAME, value: name },
    { type: BLOCK.TEXT, label: FIELD.BUSINESS_PROFILE, value: profile },
    { type: BLOCK.TEXTAREA, label: FIELD.DESCRIPTION, value: blurb }
  ]
}

/** The description block used when a row has none at all. */
export function defaultDescription (title = '') {
  return {
    label: 'Description',
    type: BLOCK.TABS,
    tabs: [
      descriptionTab('en', {
        name: title || 'Restaurant',
        profile: 'Restaurant',
        blurb: 'Welcome to our digital menu'
      }),
      descriptionTab('it', {
        name: title || 'Ristorante',
        profile: 'Ristorazione',
        blurb: 'Benvenuti nel nostro menu'
      })
    ]
  }
}

/**
 * Fills in everything the editor expects, without mutating the input.
 *
 * @param {object} structure the stored `structure` blob
 * @param {string} title the row's `title` column, used to name a missing description
 */
export function normalizeStructure (structure, title = '') {
  const source = structure && typeof structure === 'object' ? structure : {}
  const description = unwrapTabs(source.description)
  const contact = source.contact && typeof source.contact === 'object' ? source.contact : {}

  return {
    ...source,
    description: description?.tabs ? description : defaultDescription(title),
    languages: source.languages?.length ? source.languages : [...DEFAULT_LANGUAGES],
    language_main: source.language_main || 'en',
    currency: source.currency || DEFAULT_CURRENCY,
    color_main: source.color_main || DEFAULT_COLOR_MAIN,
    color_background: source.color_background || DEFAULT_COLOR_BACKGROUND,
    color_theme: source.color_theme || 'light',
    // Images live on the structure so they persist and stay per-restaurant.
    logo: typeof source.logo === 'string' ? source.logo : '',
    contact: Object.fromEntries(CONTACT_FIELDS.map(field => [field, contact[field] || '']))
  }
}

/** The starting state for a brand-new restaurant. */
export function blankStructure (name = 'My restaurant') {
  return {
    ...normalizeStructure({}, name),
    name,
    languages: ['en'],
    color_main: '#1f5140',
    description: {
      label: 'Description',
      type: BLOCK.TABS,
      tabs: [
        descriptionTab('en', {
          name,
          profile: 'Restaurant',
          blurb: 'Welcome to our menu.'
        })
      ]
    }
  }
}
