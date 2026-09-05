/**
 * Per-page title and description.
 *
 * The app is a single HTML file, so every route otherwise inherits the same
 * generic title. A published menu is the product's shareable surface and
 * deserves the restaurant's own name in the tab, in a bookmark, and in
 * Google's index (Googlebot renders JavaScript).
 *
 * Caveat: og: scrapers — WhatsApp, Facebook, LinkedIn, Slack — do NOT run
 * JavaScript. They will keep reading the static tags in index.html. Giving a
 * shared menu link its own preview image needs prerendering at the edge; see
 * ROADMAP.md.
 */

const SITE_TITLE = 'FoodBoard — Digital Restaurant Menu Builder'
const SITE_DESCRIPTION =
  'Build a multilingual restaurant menu with prices and EU allergen labelling, ' +
  'then publish it to diners through a link or QR code.'

const setTag = (selector, attribute, value) => {
  const tag = document.head.querySelector(selector)
  if (tag) tag.setAttribute(attribute, value)
}

/** Applies a title and description, falling back to the site defaults. */
export const setPageMeta = ({ title, description } = {}) => {
  if (typeof document === 'undefined') return
  const resolvedTitle = title || SITE_TITLE
  const resolvedDescription = description || SITE_DESCRIPTION

  document.title = resolvedTitle
  setTag('meta[name="description"]', 'content', resolvedDescription)
  setTag('meta[property="og:title"]', 'content', resolvedTitle)
  setTag('meta[property="og:description"]', 'content', resolvedDescription)
  setTag('meta[name="twitter:title"]', 'content', resolvedTitle)
  setTag('meta[name="twitter:description"]', 'content', resolvedDescription)
}

export const resetPageMeta = () => setPageMeta()

/* -------------------------------------------------------------------------
 * <html lang>
 *
 * index.html is served with lang="en" and nothing ever changed it, so a
 * Romanian dashboard and a Japanese menu both announced themselves as
 * English. That is not cosmetic: it is what a screen reader reads the
 * pronunciation rules from, and what Google takes the page's language to be.
 *
 * There are two languages in play and they are not the same one. The admin
 * interface has its own locale, while a published menu is written in whatever
 * the restaurant chose — a language the dashboard may not even be translated
 * into. The menu wins while it is on screen; the interface locale is restored
 * when it unmounts.
 * ---------------------------------------------------------------------- */

const DEFAULT_LANGUAGE = 'en'

let baseLanguage = DEFAULT_LANGUAGE

const applyLanguage = (lang) => {
  if (typeof document === 'undefined' || !lang) return
  document.documentElement.setAttribute('lang', lang)
}

/** Records the admin interface locale and applies it. */
export const setBaseLanguage = (lang) => {
  baseLanguage = lang || DEFAULT_LANGUAGE
  applyLanguage(baseLanguage)
}

/** Overrides the document language, e.g. for the language a menu is written in. */
export const setPageLanguage = (lang) => applyLanguage(lang || baseLanguage)

/** Puts the interface locale back. */
export const resetPageLanguage = () => applyLanguage(baseLanguage)

/** Builds the menu's title and description from what the owner published. */
export const menuPageMeta = ({ restaurant, menu, profile, description }) => {
  const name = restaurant || 'Menu'
  return {
    title: menu ? `${name} — ${menu}` : name,
    description: description || profile || `${name} — view the menu, prices and allergens.`
  }
}
