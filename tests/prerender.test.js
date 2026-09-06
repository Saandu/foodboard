import { describe, expect, it } from 'vitest'
import { descriptionFor, escapeHtml, jsonLdScript, render, sitemap } from '../scripts/prerender-lib.mjs'

/**
 * Link previews for a shared menu.
 *
 * WhatsApp, Facebook, LinkedIn and Slack read the markup as served and never
 * run the app, so what these assert is what a scraper actually sees: the
 * restaurant's own name and blurb rather than the site's generic card, and no
 * unescaped restaurant copy landing inside an attribute.
 */

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <title>FoodBoard — Digital Restaurant Menu Builder</title>
    <meta name="description" content="Generic site description."/>
    <meta property="og:title" content="FoodBoard"/>
    <meta property="og:description" content="Generic site description."/>
    <meta property="og:image" content="https://example.app/og-image.png"/>
    <meta property="og:image:width" content="1200"/>
    <meta property="og:image:height" content="630"/>
    <meta property="og:url" content="https://example.app/"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="FoodBoard"/>
    <meta name="twitter:description" content="Generic site description."/>
    <meta name="twitter:image" content="https://example.app/og-image.png"/>
</head>
<body><div id="app"></div><script src="/assets/index.js" type="module"></script></body>
</html>`

const ORIGIN = 'https://example.app'

const menu = (overrides = {}) => ({
  slug: 'trattoria-mareluna',
  title: 'Trattoria Mareluna',
  menuName: 'Menù della Sera',
  description: 'Cucina di mare nel cuore di Milano.',
  image: 'https://cdn.example/logo.webp',
  hasOwnLogo: true,
  language: 'it',
  ...overrides
})

describe('render', () => {
  it('replaces the generic card with the restaurant’s own', () => {
    const html = render(TEMPLATE, menu(), ORIGIN)

    expect(html).toContain('<title>Trattoria Mareluna</title>')
    expect(html).toContain('<meta property="og:title" content="Trattoria Mareluna"/>')
    expect(html).toContain('content="Cucina di mare nel cuore di Milano."')
    expect(html).toContain('content="https://cdn.example/logo.webp"')
    expect(html).toContain('content="https://example.app/menu/trattoria-mareluna"')
  })

  it('announces the menu’s own language', () => {
    expect(render(TEMPLATE, menu(), ORIGIN)).toContain('<html lang="it"')
  })

  it('leaves the app’s script tags alone, so the page still boots', () => {
    expect(render(TEMPLATE, menu(), ORIGIN)).toContain('<script src="/assets/index.js" type="module">')
  })

  it('drops the 1200x630 claim and asks for the small card when using a logo', () => {
    const html = render(TEMPLATE, menu(), ORIGIN)

    expect(html).not.toContain('og:image:width')
    expect(html).not.toContain('og:image:height')
    expect(html).toContain('<meta name="twitter:card" content="summary"/>')
  })

  it('keeps the large card when falling back to the site image', () => {
    const html = render(TEMPLATE, menu({ hasOwnLogo: false, image: `${ORIGIN}/og-image.png` }), ORIGIN)

    expect(html).toContain('og:image:width')
    expect(html).toContain('content="summary_large_image"')
  })

  it('escapes restaurant copy rather than letting it close an attribute', () => {
    const html = render(TEMPLATE, menu({ title: 'Bar "Quotes" & Co', description: 'A <script>alert(1)</script> blurb' }), ORIGIN)

    expect(html).toContain('content="Bar &quot;Quotes&quot; &amp; Co"')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('carries a canonical link and a schema.org Menu block', () => {
    const html = render(TEMPLATE, menu(), ORIGIN)

    expect(html).toContain('<link rel="canonical" href="https://example.app/menu/trattoria-mareluna"/>')
    const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])
    expect(jsonLd['@type']).toBe('Menu')
    expect(jsonLd.name).toBe('Menù della Sera')
    expect(jsonLd.inLanguage).toBe('it')
    expect(jsonLd.provider).toMatchObject({ '@type': 'Restaurant', name: 'Trattoria Mareluna' })
  })
})

describe('descriptionFor', () => {
  const structure = (tabs, mainLanguage = 'it') => ({
    language_main: mainLanguage,
    description: { tabs }
  })

  it('takes the blurb from the menu’s main language', () => {
    const tabs = [
      [{ tabLabel: 'it' }, { type: 'textarea', label: 'Descrizione', value: 'Cucina di mare.' }],
      [{ tabLabel: 'en' }, { type: 'textarea', label: 'Description', value: 'Seafood cooking.' }]
    ]
    expect(descriptionFor(structure(tabs))).toBe('Cucina di mare.')
    expect(descriptionFor(structure(tabs, 'en'))).toBe('Seafood cooking.')
  })

  it('returns nothing when there is no description to use', () => {
    expect(descriptionFor({})).toBe('')
    expect(descriptionFor(structure([[{ tabLabel: 'it' }]]))).toBe('')
  })
})

describe('sitemap', () => {
  it('lists the home page and every published menu', () => {
    const xml = sitemap(['a', 'b'], ORIGIN)

    expect(xml).toContain('<loc>https://example.app/</loc>')
    expect(xml).toContain('<loc>https://example.app/menu/a</loc>')
    expect(xml).toContain('<loc>https://example.app/menu/b</loc>')
    expect(xml.trim().endsWith('</urlset>')).toBe(true)
  })
})

describe('escapeHtml', () => {
  it('escapes the five characters that break out of an attribute', () => {
    expect(escapeHtml('<&">\'')).toBe('&lt;&amp;&quot;&gt;&#39;')
  })
})

describe('jsonLdScript', () => {
  /**
   * The description is written by the restaurant, so it is untrusted input on
   * a page every diner opens. A literal </script> inside it would close the
   * data block early and spill the rest of the JSON into the document.
   */
  it('cannot be closed early by a description containing a script tag', () => {
    const out = jsonLdScript({ description: 'pasta </script><script>alert(1)</script>' })

    expect(out).not.toContain('</script>')
    expect(out).not.toContain('<script>')
    expect(JSON.parse(out).description).toBe('pasta </script><script>alert(1)</script>')
  })
})
