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

/** Builds the menu's title and description from what the owner published. */
export const menuPageMeta = ({ restaurant, menu, profile, description }) => {
  const name = restaurant || 'Menu'
  return {
    title: menu ? `${name} — ${menu}` : name,
    description: description || profile || `${name} — view the menu, prices and allergens.`
  }
}
