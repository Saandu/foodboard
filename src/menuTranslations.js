/**
 * Translation lookups for the published menu.
 *
 * Records are stored as form descriptors with one tab per language — see the
 * JSONB note in README.md. These helpers pull a language's value back out and
 * decide what to show when a translation is missing.
 *
 * Kept separate from CustomerMenu.vue so the fallback rules can be tested
 * without mounting the page.
 */

/** A tab counts as translated only once some field actually carries text. */
export const hasContent = (tab) =>
  Array.isArray(tab) && tab.some(field => field.value && field.value.length)

/**
 * Picks the tab to render: the requested language when it has been filled in,
 * otherwise the first populated tab, otherwise the first tab at all.
 *
 * Falling back to *any* populated tab is deliberate. A half-translated dish
 * should still show its name rather than a blank line.
 */
export const tabFor = (tabs, lang) => {
  if (!tabs?.length) return null
  const match = tabs.find(tab => tab[0]?.tabLabel === lang)
  return hasContent(match) ? match : tabs.find(hasContent) || tabs[0]
}

/** Reads one labelled field out of a tab, or '' when it is absent. */
export const fieldValue = (tab, label) => tab?.find(field => field.label === label)?.value || ''
