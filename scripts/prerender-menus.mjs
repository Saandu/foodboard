/**
 * Writes a static HTML file per published menu, so link previews work.
 *
 *   npm run build          # runs this automatically after vite build
 *   node scripts/prerender-menus.mjs --dry-run
 *
 * The app sets its title and og: tags at runtime (src/pageMeta.js), which is
 * enough for browsers, bookmarks and Google — Googlebot renders JavaScript.
 * WhatsApp, Facebook, LinkedIn and Slack do not. They fetch the URL once, read
 * the static markup, and show whatever index.html happened to say — which for
 * every restaurant in the product was the same generic FoodBoard card. Sharing
 * a menu link *is* the product, so that was the wrong preview on the one
 * surface that matters most.
 *
 * Firebase Hosting serves a matching static file before it consults the SPA
 * rewrite, so dist/menu/<slug>/index.html wins for /menu/<slug> and the SPA
 * rewrite still catches everything else. Each generated file is index.html
 * with its head rewritten and a schema.org/Menu block added; the script tags
 * are untouched, so the page still boots into the normal app.
 *
 * The tradeoff, stated plainly: these are generated at build time, so a menu
 * created after the last deploy previews with the generic card until the next
 * one. Getting it right for every menu the instant it is published needs the
 * request intercepted at the edge, which Firebase Hosting cannot do without
 * Cloud Run. For a portfolio deployment, a deploy-time snapshot buys the whole
 * visible benefit at none of that cost.
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './env.js'
import { descriptionFor, render, sitemap } from './prerender-lib.mjs'

loadEnv()

const dryRun = process.argv.includes('--dry-run')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const origin = (process.env.VITE_PUBLIC_MENU_ORIGIN || 'https://foodboard-demo.web.app').replace(/\/$/, '')

// CI builds without the service_role key. A build that cannot reach the
// database should still produce a working site — just one whose menus preview
// generically — so this is a skip, not a failure.
if (!url || !serviceKey) {
  console.log('Prerender skipped: no SUPABASE_SERVICE_ROLE_KEY. Menus will use the generic preview card.')
  process.exit(0)
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const publicUrl = (path) => path
  ? db.storage.from('structure-media').getPublicUrl(path).data.publicUrl
  : `${origin}/og-image.png`

async function main () {
  const { data: rows, error } = await db
    .from('structures').select('structure_id, title, public_slug, structure')
  if (error) throw new Error(`Could not read structures: ${error.message}`)

  const template = readFileSync(join(dist, 'index.html'), 'utf8')
  const written = []

  for (const row of rows || []) {
    if (!row.public_slug) continue

    // Only menus a diner can actually open. get_public_menu returns null when
    // no list is active, and prerendering an unpublished menu would put the
    // restaurant's name into a preview for a page that shows nothing.
    const { data: menu, error: menuError } = await db.rpc('get_public_menu', { p_slug: row.public_slug })
    if (menuError) throw new Error(`get_public_menu(${row.public_slug}) failed: ${menuError.message}`)
    if (!menu) {
      console.log(`  skipped ${row.public_slug} — no published menu`)
      continue
    }

    const structure = row.structure || {}
    const title = structure.name || row.title || 'Menu'
    const description = descriptionFor(structure)
      || `See the menu for ${title} — dishes, prices and allergens.`

    const html = render(template, {
      slug: row.public_slug,
      title,
      menuName: menu.list?.title,
      description,
      image: publicUrl(structure.logo),
      hasOwnLogo: Boolean(structure.logo),
      language: structure.language_main || 'en'
    }, origin)

    if (!dryRun) {
      // <slug>.html rather than <slug>/index.html. Hosting answers a directory
      // request without its trailing slash with a 301, and the app's routes —
      // and every printed QR code — are the slashless form. With cleanUrls on,
      // this shape serves /menu/<slug> directly, at the URL people actually
      // hold, and vue-router sees the path its route was written for.
      mkdirSync(join(dist, 'menu'), { recursive: true })
      writeFileSync(join(dist, 'menu', `${row.public_slug}.html`), html)
    }
    written.push(row.public_slug)
    console.log(`  ${dryRun ? 'would write' : 'wrote'} menu/${row.public_slug}.html — "${title}"`)
  }

  if (!dryRun) writeFileSync(join(dist, 'sitemap.xml'), sitemap(written, origin))
  console.log(
    `Prerendered ${written.length} menu(s)` +
    `${dryRun ? ' (dry run — nothing written)' : ` and sitemap.xml with ${written.length + 1} URLs`}.`
  )
}

main().catch(err => {
  console.error('\nPrerender failed:', err.message)
  process.exit(1)
})
