/**
 * Reseeds the demo database.
 *
 * This script rebuilds only the showcase account from `demo-data.js`. It is
 * deliberately scoped so the scheduled demo reset can never erase customers'
 * private workspaces.
 *
 *   npm run seed
 *
 * Credentials come from .env (see .env.example). SUPABASE_SERVICE_ROLE_KEY is
 * required: RLS scopes every table to its owner, so the publishable key cannot
 * write these rows.
 *
 * SHOWCASE_USER_ID decides who owns the demo restaurants. Set it to the auth
 * user id you sign in with, otherwise the reset hands the showcase to a
 * placeholder owner and your dashboard shows an empty workspace.
 */

import { createClient } from '@supabase/supabase-js'
import { demoUser, demoStructures } from './demo-data.js'
import { loadEnv, requireServiceCredentials } from './env.js'
import {
  LANGS,
  blankCategoryModal,
  blankDivisorModal,
  blankListModal,
  blankProductModal,
  buildCategory,
  buildProduct,
  displayName,
  listRow,
  t,
  tabsBlock
} from './shapes.js'

loadEnv()

const { url, serviceKey } = requireServiceCredentials()

/**
 * Who owns the showcase restaurants. Defaults to the placeholder id in
 * demo-data.js, which is fine for a throwaway database but means no real
 * account can see the demo in its dashboard — RLS matches rows against
 * auth.uid(), and the placeholder is not a real auth user.
 */
const showcaseUserId = process.env.SHOWCASE_USER_ID?.trim() || demoUser.user_id

/** True when the showcase belongs to a real signed-up account. */
const ownedByRealAccount = showcaseUserId !== demoUser.user_id

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

/* ------------------------------------------------------------------ *
 * Wipe and insert
 * ------------------------------------------------------------------ */

async function wipe () {
  const structureIds = demoStructures.map(structure => structure.structure_id)
  const listIds = demoStructures.flatMap(structure => structure.lists.map(list => list.list_id))
  const categoryIds = demoStructures.flatMap(structure => structure.lists.flatMap(list => list.categories.map(category => category.category_id)))
  const deletes = [
    ['products', 'category_id', categoryIds],
    ['categories', 'list_id', listIds],
    ['lists', 'structure_id', structureIds],
    ['structures', 'structure_id', structureIds]
  ]
  // Only the placeholder users row is ours to remove. When the showcase belongs
  // to a real account, its users row is owned by Supabase Auth's signup trigger
  // and deleting it would wipe the person's profile.
  if (!ownedByRealAccount) {
    deletes.push(['users', 'user_id', [demoUser.user_id]])
  }

  for (const [table, column, values] of deletes) {
    const { error } = await supabase.from(table).delete().in(column, values)
    if (error) throw new Error(`Failed clearing demo ${table}: ${error.message}`)
    console.log(`  cleared demo ${table}`)
  }
}

/**
 * Reads the logo currently on each demo structure.
 *
 * demo-data.js carries menu content, not branding — images are uploaded
 * through the dashboard. Without this the nightly reset would blank them,
 * and for a base64 image there would be no copy left anywhere. Whatever the
 * column holds is carried over verbatim, so it works for both a Storage path
 * and a legacy data URL.
 */
async function readExistingImages () {
  const structureIds = demoStructures.map(structure => structure.structure_id)
  const { data, error } = await supabase
    .from('structures').select('structure_id, structure').in('structure_id', structureIds)

  if (error) throw new Error(`Failed reading existing images: ${error.message}`)

  const images = new Map()
  for (const row of data || []) {
    const structure = row.structure || {}
    images.set(row.structure_id, {
      logo: typeof structure.logo === 'string' ? structure.logo : ''
    })
  }
  return images
}

/**
 * Reads the photo currently attached to each demo dish.
 *
 * Products are rebuilt wholesale from demo-data.js, which describes menu
 * content and not pictures, so without this every reset wiped the dish photos
 * and orphaned their Storage objects. Keyed by row and dish name rather than
 * by position, so reordering demo-data.js cannot shuffle photos onto the
 * wrong dishes.
 *
 * Note: if a shared guest-demo account is ever added, this also preserves
 * whatever a visitor uploaded. See ROADMAP.md.
 */
async function readExistingPhotos () {
  const { data, error } = await supabase.from('products').select('product_id, product')
  if (error) throw new Error(`Failed reading existing photos: ${error.message}`)

  const photos = new Map()
  for (const row of data || []) {
    for (const item of row.product?.products || []) {
      const file = (item.editModal || []).find(block => block?.type === 'file')
      if (file?.value) photos.set(`${row.product_id}::${item.name}`, file.value)
    }
  }
  return photos
}

/** Puts carried-over photos back onto the freshly built dish descriptors. */
function applyPhotos (productRows, photos) {
  if (!photos.size) return 0
  let restored = 0
  for (const row of productRows) {
    for (const item of row.product.products) {
      const carried = photos.get(`${row.product_id}::${item.name}`)
      if (!carried) continue
      const file = (item.editModal || []).find(block => block?.type === 'file')
      if (!file) continue
      file.value = carried
      restored++
    }
  }
  return restored
}

async function insert (table, rows) {
  if (!rows.length) return
  const { error } = await supabase.from(table).insert(rows)
  if (error) throw new Error(`Failed inserting into ${table}: ${error.message}`)
  console.log(`  inserted ${rows.length} into ${table}`)
}

function buildRows (existingImages = new Map()) {
  // A real account already has a users row, created by the signup trigger, and
  // it holds the person's own name — leave it alone and only seed the
  // placeholder profile when nobody real owns the showcase.
  const users = ownedByRealAccount ? [] : [{
    user_id: showcaseUserId,
    name: demoUser.name,
    surname: demoUser.surname,
    settings: {
      account: { url: '#', label: 'account_link', target: '_self' },
      menu: { url: '#', label: 'profile_link', target: '_self' },
      logout: { url: '/login', label: 'logout', target: '_self' }
    },
    notifications: []
  }]

  const structures = []
  const lists = []
  const categories = []
  const products = []

  for (const structure of demoStructures) {
    const mainLang = structure.language_main
    // Branding is uploaded through the dashboard, not described in
    // demo-data.js, so it survives the wipe rather than being rebuilt.
    const images = existingImages.get(structure.structure_id)
      || { logo: '' }

    structures.push({
      structure_id: structure.structure_id,
      user_id: showcaseUserId,
      // Real structures get a random slug from the column default; the demo
      // pins readable ones so the links in the README stay stable.
      public_slug: structure.public_slug,
      title: structure.title,
      structure: {
        name: structure.title,
        languages: structure.languages,
        language_main: mainLang,
        currency: structure.currency,
        color_main: structure.color_main,
        color_background: structure.color_background,
        logo: images.logo,
        contact: structure.contact || {},
        description: {
          label: 'Description',
          type: 'tabs',
          tabs: LANGS.map(lang => [
            { tabLabel: lang },
            { type: 'text', label: 'Nome struttura', value: structure.title },
            { type: 'text', label: 'Profilo attivita', value: t(structure.profile, lang) },
            { type: 'textarea', label: 'Descrizione', value: t(structure.description, lang) }
          ])
        }
      }
    })

    for (const list of structure.lists) {
      const itemCount = list.categories.reduce(
        (total, category) => total + category.items.filter(i => i.type !== 'divisor').length,
        0
      )

      lists.push({
        list_id: list.list_id,
        structure_id: structure.structure_id,
        user_id: showcaseUserId,
        title: displayName(list.name, mainLang),
        is_active: list.active,
        has_sublists: false,
        data: {
          list_id: list.list_id,
          name: displayName(list.name, mainLang),
          active: list.active,
          count: itemCount,
          category: list.categories.length,
          editModal: [tabsBlock(listRow(list))],
          addModal: blankListModal()
        }
      })

      // One `categories` row holds every category in a list, keyed by list id.
      categories.push({
        category_id: list.list_id,
        list_id: list.list_id,
        user_id: showcaseUserId,
        category: {
          categories: list.categories.map(c => buildCategory(c, mainLang)),
          addCategoryModal: blankCategoryModal()
        }
      })

      // One `products` row holds every item in a category, keyed by category id.
      for (const category of list.categories) {
        products.push({
          product_id: category.category_id,
          category_id: category.category_id,
          user_id: showcaseUserId,
          product: {
            products: category.items.map(i => buildProduct(i, mainLang)),
            addProductModal: blankProductModal(),
            addDivisorModal: blankDivisorModal()
          }
        })
      }
    }
  }

  return { users, structures, lists, categories, products }
}

async function main () {
  // Read before the wipe, or the images are gone by the time we rebuild.
  const existingImages = await readExistingImages()
  const existingPhotos = await readExistingPhotos()
  const { users, structures, lists, categories, products } = buildRows(existingImages)

  const carried = structures.filter(row => row.structure.logo).length
  if (carried) console.log(`Carrying over branding for ${carried} structure(s).`)

  const restoredPhotos = applyPhotos(products, existingPhotos)
  if (restoredPhotos) console.log(`Carrying over ${restoredPhotos} dish photo(s).`)

  console.log(
    ownedByRealAccount
      ? `Showcase owner: ${showcaseUserId}`
      : `Showcase owner: ${showcaseUserId} (placeholder — set SHOWCASE_USER_ID ` +
        'to your auth user id so the demo appears in your dashboard)'
  )

  console.log('Clearing existing data...')
  await wipe()

  console.log('Seeding demo content...')
  await insert('users', users)
  await insert('structures', structures)
  await insert('lists', lists)
  await insert('categories', categories)
  await insert('products', products)

  const dishes = products.reduce(
    (total, row) => total + row.product.products.filter(p => p.type !== 'divisor').length,
    0
  )
  console.log(
    `\nDone — ${structures.length} structures, ${lists.length} menus, ` +
    `${categories.length} category groups, ${dishes} dishes.`
  )
}

main().catch(err => {
  console.error('\nSeed failed:', err.message)
  process.exit(1)
})
