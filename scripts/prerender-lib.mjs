/**
 * The pure half of scripts/prerender-menus.mjs: turning one menu row into the
 * HTML a link-preview scraper will read, and the URL set into a sitemap.
 *
 * Split out so it can be tested without a database or a dist/ directory. The
 * script keeps the IO — reading the build, querying Supabase, writing files.
 */

import { tabFor } from '../src/menuTranslations.js'

export const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/**
 * Serialises JSON-LD for embedding in an inline script.
 *
 * The restaurant writes its own description, and a literal `</script>` in it
 * would otherwise close the block early and drop the rest of the JSON into the
 * document as markup. Escaping the three characters that can start a tag or an
 * entity keeps it valid JSON — a parser reads the escapes, an HTML tokeniser
 * never sees a tag. The page's CSP would stop injected script from running;
 * this stops it from being written at all.
 */
export const jsonLdScript = (data) => JSON.stringify(data)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

/** The first textarea in the main-language tab: the restaurant's own blurb. */
export const descriptionFor = (structure) => {
  const tabs = structure?.description?.tabs
  if (!Array.isArray(tabs)) return ''
  const tab = tabFor(tabs, structure.language_main) || tabs[0]
  const field = (tab || []).find(entry => entry?.type === 'textarea' && entry.value)
  return (field?.value || '').trim()
}

/**
 * Replaces the content of one meta tag, matched on the attribute that
 * identifies it. Written against the exact shape of index.html rather than
 * with a parser: the file is ours, it is 30 lines, and a dependency to rewrite
 * six attributes would be the more fragile choice.
 */
export const setMeta = (html, attribute, name, content) => {
  const pattern = new RegExp(`(<meta[^>]*${attribute}="${name}"[^>]*content=")[^"]*(")`, 'i')
  if (!pattern.test(html)) {
    throw new Error(`index.html has no <meta ${attribute}="${name}"> to rewrite`)
  }
  return html.replace(pattern, `$1${escapeHtml(content)}$2`)
}

export const render = (template, menu, origin) => {
  const { slug, title, description, image, language } = menu
  let html = template
    .replace(/<html lang="[^"]*"/i, `<html lang="${escapeHtml(language)}"`)
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)

  html = setMeta(html, 'name', 'description', description)
  html = setMeta(html, 'property', 'og:title', title)
  html = setMeta(html, 'property', 'og:description', description)
  html = setMeta(html, 'property', 'og:image', image)
  html = setMeta(html, 'property', 'og:url', `${origin}/menu/${slug}`)
  html = setMeta(html, 'name', 'twitter:title', title)
  html = setMeta(html, 'name', 'twitter:description', description)
  html = setMeta(html, 'name', 'twitter:image', image)

  // A menu is a documented schema.org type, and a restaurant's menu is exactly
  // what someone searches for by name.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: menu.menuName || title,
    url: `${origin}/menu/${slug}`,
    inLanguage: language,
    ...(description ? { description } : {}),
    ...(menu.hasOwnLogo ? { image } : {}),
    provider: { '@type': 'Restaurant', name: title, url: `${origin}/menu/${slug}` }
  }

  // index.html advertises a 1200x630 card for the site's own og-image. A
  // restaurant's logo is neither of those, and a card that lies about its
  // dimensions renders letterboxed or cropped. Drop the claim and ask for the
  // small card instead, which is what a square logo actually suits.
  if (menu.hasOwnLogo) {
    html = html
      .replace(/\s*<meta property="og:image:(width|height)"[^>]*\/?>/gi, '')
      .replace(/(<meta name="twitter:card" content=")[^"]*(")/i, '$1summary$2')
  }

  return html.replace(
    '</head>',
    `    <link rel="canonical" href="${origin}/menu/${slug}"/>\n` +
    `    <script type="application/ld+json">${jsonLdScript(jsonLd)}</script>\n</head>`
  )
}

export const sitemap = (slugs, origin) => [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  `  <url><loc>${origin}/</loc><priority>0.8</priority></url>`,
  ...slugs.map(slug => `  <url><loc>${origin}/menu/${slug}</loc><priority>1.0</priority></url>`),
  '</urlset>',
  ''
].join('\n')
