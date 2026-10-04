// Explicit live release check. Creates disposable confirmed accounts, makes
// real Gemini requests, and deletes only those accounts and their test data.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'
import { chromium } from '@playwright/test'
import { loadEnv, requireServiceCredentials } from './env.js'
import { validateDraft } from '../supabase/functions/_shared/menu-import.js'

loadEnv()
const { url, serviceKey } = requireServiceCredentials()
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
assert.ok(key, 'Missing publishable key')
const origin = process.env.MENU_IMPORT_TEST_ORIGIN || 'https://foodboard-demo.web.app'
const apiOnly = process.argv.includes('--api-only')
const browserOnly = process.argv.includes('--browser-only')
assert.ok(apiOnly !== browserOnly, 'Choose exactly one mode: --api-only or --browser-only')
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const accounts = []
let browser
const check = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data }
const fixtureLines = ['FOODBOARD SMOKE TEST MENU', 'Currency: EUR', 'Main courses', 'Garden pasta - 12.50 EUR', 'Tomatoes and basil. Declared allergen: gluten.', 'Grilled vegetables - Small 9.00 EUR / Large 14.00 EUR', 'Seasonal vegetables and olive oil.', 'Desserts', 'Chocolate cake - 6.00 EUR', 'Declared allergens: gluten, eggs, milk.']

async function account () {
  const password = `${crypto.randomUUID()}Aa!9`
  const email = `foodboard-import-smoke-${crypto.randomUUID()}@example.invalid`
  const { user } = check(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Create test account')
  accounts.push(user.id)
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { session } = check(await client.auth.signInWithPassword({ email, password }), 'Sign in test account')
  return { client, session, user }
}
async function call (session, structureId, action, body, id = crypto.randomUUID()) {
  const response = await fetch(`${url}/functions/v1/menu-import`, {
    method: 'POST',
    headers: { apikey: key, ...(session ? { authorization: `Bearer ${session.access_token}` } : {}), origin, 'x-structure-id': structureId, 'x-import-action': action, 'x-import-id': id, 'content-type': action === 'save' ? 'application/json' : 'application/pdf' },
    body: action === 'save' ? JSON.stringify(body) : body
  })
  return { status: response.status, data: await response.json() }
}
async function verifySaved (client, structureId, listId) {
  const list = check(await client.from('lists').select('*').eq('list_id', listId).single(), 'Read saved list')
  assert.equal(list.structure_id, structureId)
  assert.equal(list.is_active, false)
  assert.equal(list.data.active, false)
  const category = check(await client.from('categories').select('*').eq('list_id', listId).single(), 'Read saved categories')
  assert.ok(category.category.categories.length >= 2)
  const ids = category.category.categories.map(row => row.category_id)
  const products = check(await client.from('products').select('*').in('category_id', ids), 'Read saved products')
  const dishes = products.flatMap(row => row.product.products)
  assert.equal(dishes.length, 3)
  const vegetables = dishes.find(row => /vegetable/i.test(row.name))
  assert.ok(vegetables, 'Vegetable dish preserved')
  assert.ok(vegetables.editModal[0].tabs.some(tab => tab.find(field => field.type === 'prices')?.value.length === 2), 'Both portion prices preserved')
  assert.equal(check(await client.from('lists').select('*').eq('structure_id', structureId), 'Count saved menus').length, 1)
  console.log(JSON.stringify({ check: 'saved-draft', categories: ids.length, dishes: dishes.length, unpublished: true, multiplePrices: true }))
}

try {
  const owner = await account()
  const structureId = crypto.randomUUID()
  check(await owner.client.from('structures').insert({ structure_id: structureId, user_id: owner.user.id, title: 'Disposable import smoke test', structure: { currency: '€', languages: ['en'], language_main: 'en' } }), 'Create test restaurant')
  console.log(JSON.stringify({ check: 'test-workspace', userId: owner.user.id, structureId }))
  await fs.mkdir('test-results', { recursive: true })
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([800, 600])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  fixtureLines.forEach((line, index) => page.drawText(line, { x: 35, y: 550 - index * 45, size: 19, font }))
  const pdfBytes = await pdf.save()
  await fs.writeFile('test-results/menu-import-live.pdf', pdfBytes)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850"><rect width="1200" height="850" fill="white"/>${fixtureLines.map((line, index) => `<text x="40" y="65" transform="translate(0,${index * 70})" font-family="Arial" font-size="28" fill="black">${line}</text>`).join('')}</svg>`
  await sharp(Buffer.from(svg)).png().toFile('test-results/menu-import-live.png')

  if (!browserOnly) {
    const second = await account()
    assert.equal((await call(null, structureId, 'extract', pdfBytes)).status, 401)
    assert.equal((await call(second.session, structureId, 'extract', pdfBytes)).status, 403)
    assert.equal((await call(owner.session, structureId, 'extract', 'not a file')).status, 400)
    const id = crypto.randomUUID()
    const started = Date.now()
    const extraction = await call(owner.session, structureId, 'extract', pdfBytes, id)
    assert.equal(extraction.status, 200, `PDF extraction failed: ${JSON.stringify(extraction.data)}`)
    const draft = validateDraft(extraction.data.draft)
    console.log(JSON.stringify({ check: 'real-pdf-extraction', latencyMs: Date.now() - started, categories: draft.categories.length, dishes: draft.categories.reduce((count, category) => count + category.items.length, 0) }))
    const saved = await call(owner.session, structureId, 'save', draft, id)
    assert.equal(saved.status, 200, JSON.stringify(saved.data))
    const retry = await call(owner.session, structureId, 'save', draft, id)
    assert.deepEqual(retry, saved)
    await verifySaved(owner.client, structureId, saved.data.list_id)
    assert.equal((await call(owner.session, structureId, 'extract', pdfBytes)).status, 429)
    console.log(JSON.stringify({ check: 'live-auth-ownership-idempotency-and-quota', passed: true }))
  }
  if (!apiOnly) {
    // A separate disposable account keeps the browser check independent; the
    // project reservation still enforces a minimum of 15 seconds between calls.
    if (!browserOnly) throw new Error('Run --api-only and --browser-only separately, with at least 15 seconds between extraction calls')
    browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const projectRef = new URL(url).hostname.split('.')[0]
    await context.addInitScript(({ projectRef, session }) => localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(session)), { projectRef, session: owner.session })
    const browserPage = await context.newPage()
    await browserPage.goto(`${origin}/import-menu?structure_id=${structureId}`)
    await browserPage.getByRole('heading', { name: 'Import a menu', exact: true }).waitFor()
    await browserPage.locator('input[type=file]').setInputFiles('test-results/menu-import-live.png')
    await browserPage.getByRole('checkbox', { name: /permission to send/ }).check()
    const extractionResponse = browserPage.waitForResponse(response => response.url().endsWith('/functions/v1/menu-import') && response.request().headers()['x-import-action'] === 'extract', { timeout: 100000 })
    await browserPage.getByRole('button', { name: 'Extract menu', exact: true }).click()
    const extracted = await extractionResponse
    assert.equal(extracted.status(), 200, `Live browser extraction failed: ${await extracted.text()}`)
    await browserPage.getByLabel('Menu name', { exact: true }).waitFor()
    await browserPage.screenshot({ path: 'test-results/menu-import-live-review.png', fullPage: true })
    await browserPage.getByRole('checkbox', { name: /checked the dish names/ }).check()
    await browserPage.getByRole('button', { name: 'Save as draft', exact: true }).click()
    await browserPage.waitForURL(/\/lists\?structure_id=/)
    const lists = check(await owner.client.from('lists').select('*').eq('structure_id', structureId), 'Read browser saved menu')
    assert.equal(lists.length, 1)
    await verifySaved(owner.client, structureId, lists[0].list_id)
    console.log(JSON.stringify({ check: 'real-image-browser-upload-review-save', passed: true, origin }))
  }
  const usage = check(await admin.from('menu_import_attempts').select('model,usage').eq('user_id', owner.user.id), 'Read token accounting')
  console.log(JSON.stringify({ check: 'provider-token-accounting', attempts: usage }))
} finally {
  await browser?.close()
  let failures = 0
  for (const id of accounts) {
    const deleted = await admin.auth.admin.deleteUser(id)
    if (deleted.error) { failures++; console.error(`Test account cleanup failed for ${id}: ${deleted.error.message}`) }
  }
  console.log(JSON.stringify({ check: 'cleanup', accountsRemoved: accounts.length - failures, failed: failures }))
  if (failures) process.exitCode = 1
}
