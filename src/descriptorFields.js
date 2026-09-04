/**
 * The field names used inside a record's stored form descriptor.
 *
 * Records are saved as UI form descriptors rather than typed columns, and the
 * field labels were written in Italian when the schema was first designed.
 * Those strings are part of the saved data — the published menu looks fields
 * up by them — so they cannot be renamed without migrating every row.
 *
 * Everything that reads or writes a descriptor goes through the constants
 * below rather than repeating the literals, so the day those rows are migrated
 * to typed columns this file is the only place the old names appear.
 */

export const FIELD = {
  TITLE: 'Titolo',
  DESCRIPTION: 'Descrizione',
  PHOTO: 'Foto',
  STRUCTURE_NAME: 'Nome struttura',
  BUSINESS_PROFILE: 'Profilo attivita',
  EXTRA_DESCRIPTION_TITLE: 'Titolo per descrizione aggiuntiva (Facoltativo)',
  EXTRA_DESCRIPTION: 'Descrizione aggiuntiva (Facoltativo)',
  DETAILS_TITLE: 'Titolo per dettagli (Facoltativo)',
  DETAILS: 'Dettagli aggiuntivi (Facoltativo)',
  ALLERGENS: 'Allergens',
  NAME: 'Name'
}

/** Descriptor block types, which are language-neutral and safe to compare on. */
export const BLOCK = {
  FILE: 'file',
  PRICES: 'prices',
  DESCRIPTION_ROWS: 'description_rows',
  TABS: 'tabs',
  TEXT: 'text',
  TEXTAREA: 'textarea'
}

/** Maps each stored field name to the translation key that renders it. */
const LABEL_KEYS = {
  [FIELD.TITLE]: 'title',
  [FIELD.DESCRIPTION]: 'description',
  [FIELD.PHOTO]: 'photo',
  [FIELD.STRUCTURE_NAME]: 'structure_name',
  [FIELD.BUSINESS_PROFILE]: 'business_profile',
  [FIELD.EXTRA_DESCRIPTION_TITLE]: 'extra_description_title',
  [FIELD.EXTRA_DESCRIPTION]: 'extra_description',
  [FIELD.DETAILS_TITLE]: 'details_title',
  [FIELD.DETAILS]: 'details',
  [FIELD.ALLERGENS]: 'allergens',
  [FIELD.NAME]: 'name'
}

/**
 * Translates a stored field name for display, falling back to the raw string
 * for anything not in the map (e.g. a label typed by the restaurant owner).
 *
 * @param {string} label stored field name
 * @param {(key: string) => string} t vue-i18n translate function
 */
export function translateFieldLabel (label, t) {
  if (!label) return ''
  const key = LABEL_KEYS[label.trim()]
  return key ? t(key) : label
}
