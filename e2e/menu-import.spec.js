import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { buildMenuRecords } from '../supabase/functions/_shared/menu-records.js'

const owner = '11111111-1111-4111-8111-111111111111'
const menu = () => ({ title: 'Lunch menu', language: 'en', currency: 'EUR', warnings: [], categories: [{ name: 'Main courses', description: '', items: [{ name: 'Garden pasta', description: 'Tomatoes and basil', prices: [{ amount: '12.50', label: 'Small' }, { amount: '18.00', label: 'Large' }], allergens: [6], warning: '' }] }] })

async function workspace (page, { demo = false, path = '/import-menu?structure_id=test-restaurant', menus = [], protectedDelete = false } = {}) {
  const url = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
  const ref = new URL(url).hostname.split('.')[0]
  const session = {
    access_token: `fake.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`,
    refresh_token: 'fake-refresh-token', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
    user: { id: owner, email: demo ? process.env.VITE_DEMO_EMAIL : 'owner@example.test', user_metadata: {} }
  }
  await page.addInitScript(({ ref, session }) => { localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session)) }, { ref, session })
  const lists = menus
  let restaurants = [{ structure_id: 'test-restaurant', user_id: owner, title: 'Test restaurant', structure: { currency: '€', language_main: 'en', languages: ['en', 'ro'] } }]
  const calls = []
  await page.route(`${url}/**`, async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let result = []
    if (path.includes('/auth/')) result = session.user
    else if (path.endsWith('/users')) result = { user_id: owner, name: 'Test owner', settings: {}, notifications: [] }
    else if (path.endsWith('/structures')) result = restaurants
    else if (path.endsWith('/lists')) result = lists
    else if (protectedDelete && path.includes('_workspace')) {
      calls.push({ action: 'refused', path })
      return route.fulfill({ status: 400, json: { code: 'P0001', message: 'protected_account', details: null, hint: null } })
    } else if (path.includes('/storage/v1/object/') && request.method() === 'DELETE') {
      calls.push({ action: 'remove-media', paths: JSON.parse(request.postData()).prefixes })
    } else if (path.endsWith('/delete_menu_workspace')) {
      const id = JSON.parse(request.postData()).p_list_id
      lists.splice(lists.findIndex(row => row.list_id === id), 1)
      calls.push({ action: 'delete-menu', id })
      result = [`${owner}/test-restaurant/dish-1.webp`]
    } else if (path.endsWith('/delete_restaurant_workspace')) {
      const id = JSON.parse(request.postData()).p_structure_id
      restaurants = restaurants.filter(row => row.structure_id !== id)
      calls.push({ action: 'delete-restaurant', id })
      result = null
    }
    else if (path.endsWith('/menu-import')) {
      const action = request.headers()['x-import-action']
      calls.push({ action, id: request.headers()['x-import-id'], body: request.postData() })
      if (action === 'extract') result = { draft: menu() }
      else {
        const records = buildMenuRecords(JSON.parse(request.postData()), 'test-restaurant', owner, () => 'saved-menu')
        lists.push(records.list)
        result = { list_id: 'saved-menu' }
      }
    }
    await route.fulfill({ json: result })
  })
  await page.goto(path)
  return calls
}

test('menu deletion is visible, cancellation preserves it and confirmation removes it', async ({ page }) => {
  const records = buildMenuRecords(menu(), 'test-restaurant', owner, () => 'saved-menu')
  const calls = await workspace(page, { path: '/lists?structure_id=test-restaurant', menus: [records.list] })
  const remove = page.getByRole('button', { name: 'Delete menu Lunch menu', exact: true })
  await expect(remove).toBeVisible()
  await accessible(page)
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('cannot be undone'); await dialog.dismiss() })
  await remove.click()
  await expect(remove).toBeVisible()
  expect(calls).toEqual([])
  page.once('dialog', dialog => dialog.accept())
  await remove.click()
  await expect(page.getByRole('button', { name: 'Create your first menu', exact: true })).toBeVisible()
  await expect.poll(() => calls).toEqual([{ action: 'delete-menu', id: 'saved-menu' }, { action: 'remove-media', paths: [`${owner}/test-restaurant/dish-1.webp`] }])
})

test('the shared demo explains that its menus and restaurant cannot be deleted', async ({ page }) => {
  const records = buildMenuRecords(menu(), 'test-restaurant', owner, () => 'saved-menu')
  await workspace(page, { demo: true, protectedDelete: true, path: '/lists?structure_id=test-restaurant', menus: [records.list] })
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete menu Lunch menu', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('demo restaurant')
  await expect(page.getByRole('button', { name: 'Delete menu Lunch menu', exact: true })).toBeVisible()
})

test('restaurant deletion confirms its scope and returns to an empty dashboard', async ({ page }) => {
  const calls = await workspace(page, { path: '/structures' })
  const remove = page.getByRole('button', { name: 'Delete restaurant', exact: true })
  await expect(remove).toBeVisible()
  await accessible(page)
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('Test restaurant'); await dialog.dismiss() })
  await remove.click()
  await expect(remove).toBeVisible()
  expect(calls).toEqual([])
  page.once('dialog', dialog => dialog.accept())
  await remove.click()
  await expect(remove).toHaveCount(0)
  await expect(page.locator('.workspace-empty')).toBeVisible()
  expect(calls).toEqual([{ action: 'delete-restaurant', id: 'test-restaurant' }])
})

test('first dashboard exposes a direct import shortcut for its restaurant', async ({ page }, testInfo) => {
  await workspace(page, { path: '/structures' })
  const shortcut = page.getByRole('link', { name: 'Import from PDF or photo', exact: true })
  await expect(shortcut).toBeVisible()
  await expect(shortcut).toHaveAttribute('href', '/import-menu?structure_id=test-restaurant')
  await accessible(page)
  await page.screenshot({ path: testInfo.outputPath('dashboard-import.png'), fullPage: true })
  await shortcut.click()
  await expect(page.locator('input[type=file]')).toBeEnabled()
})

test('shared demo uploads, extracts and saves a draft', async ({ page }) => {
  test.skip(!process.env.VITE_DEMO_EMAIL || !process.env.VITE_DEMO_PASSWORD, 'Demo credentials are not configured')
  const calls = await workspace(page, { demo: true })
  await expect(page.locator('input[type=file]')).toBeEnabled()
  await page.locator('input[type=file]').setInputFiles({ name: 'menu.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 test menu') })
  await page.getByRole('checkbox', { name: /permission to send/ }).check()
  await page.getByRole('button', { name: 'Extract menu', exact: true }).click()
  await page.getByRole('checkbox', { name: /checked the dish names/ }).check()
  await confirmAllergens(page)
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click()
  await expect(page).toHaveURL(/\/lists\?structure_id=test-restaurant/)
  await expect(page.getByText('Lunch menu', { exact: true })).toBeVisible()
  expect(calls.map(call => call.action)).toEqual(['extract', 'save'])
})

async function confirmAllergens (page) {
  await page.getByRole('button', { name: 'Next: confirm allergens', exact: true }).click()
  await page.getByRole('checkbox', { name: /allergens of every dish/ }).check()
}

async function accessible (page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(violations.filter(issue => ['serious', 'critical'].includes(issue.impact))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

test('owner extracts, reviews and saves an unpublished menu', async ({ page }, testInfo) => {
  const calls = await workspace(page)
  await expect(page.getByRole('heading', { name: 'Import a menu', exact: true })).toBeVisible()
  await accessible(page)
  await page.locator('input[type=file]').setInputFiles({ name: 'menu.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 test menu') })
  await expect(page.getByRole('button', { name: 'Extract menu', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: /permission to send/ }).check()
  await page.getByRole('button', { name: 'Extract menu', exact: true }).click()
  await expect(page.getByLabel('Menu name', { exact: true })).toHaveValue('Lunch menu')
  await expect(page.getByLabel('Price', { exact: true })).toHaveCount(2)
  await page.getByLabel('Menu name', { exact: true }).fill('Reviewed lunch menu')
  await expect(page.getByRole('button', { name: 'Next: confirm allergens', exact: true })).toBeDisabled()
  await accessible(page)
  await page.screenshot({ path: testInfo.outputPath('menu-review.png'), fullPage: true })
  await page.getByRole('checkbox', { name: /checked the dish names/ }).check()
  await confirmAllergens(page)
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click()
  await expect(page).toHaveURL(/\/lists\?structure_id=test-restaurant/)
  await expect(page.getByText('Reviewed lunch menu', { exact: true })).toBeVisible()
  expect(calls.map(call => call.action)).toEqual(['extract', 'save'])
  expect(calls[0].id).toBe(calls[1].id)
  expect(JSON.parse(calls[1].body).categories[0].items[0].prices).toHaveLength(2)
})

test('currency mismatch prevents saving, and edits require review again', async ({ page }) => {
  await workspace(page)
  await page.getByRole('button', { name: 'Try a sample' }).click()
  await page.getByRole('checkbox', { name: /checked the dish names/ }).check()
  await expect(page.getByRole('button', { name: 'Next: confirm allergens', exact: true })).toBeEnabled()
  await page.getByLabel('Detected currency').fill('USD')
  await expect(page.getByRole('checkbox', { name: /checked the dish names/ })).not.toBeChecked()
  await expect(page.getByText(/currencies do not match/)).toBeVisible()
  await page.getByRole('checkbox', { name: /checked the dish names/ }).check()
  await expect(page.getByRole('button', { name: 'Next: confirm allergens', exact: true })).toBeDisabled()
})

test('allergens need their own confirmation, and changing one asks again', async ({ page }) => {
  await workspace(page)
  await page.getByRole('button', { name: 'Try a sample' }).click()
  await expect(page.getByRole('button', { name: 'Save as draft', exact: true })).toHaveCount(0)
  await page.getByRole('checkbox', { name: /checked the dish names/ }).check()
  await page.getByRole('button', { name: 'Next: confirm allergens', exact: true }).click()
  await expect(page.getByText('1 of 2 dishes have declared allergens.')).toBeVisible()
  await accessible(page)
  const save = page.getByRole('button', { name: 'Save as draft', exact: true })
  const confirm = page.getByRole('checkbox', { name: /allergens of every dish/ })
  await expect(save).toBeDisabled()
  await confirm.check()
  await expect(save).toBeEnabled()
  await page.getByRole('group', { name: 'Grilled vegetables' }).getByRole('checkbox', { name: 'Milk' }).check()
  await expect(confirm).not.toBeChecked()
  await expect(save).toBeDisabled()
  await page.getByRole('button', { name: 'Back to dishes', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /checked the dish names/ })).toBeChecked()
})

test('a draft survives the tab being closed before saving', async ({ page }) => {
  await workspace(page)
  await page.getByRole('button', { name: 'Try a sample' }).click()
  await page.getByLabel('Menu name', { exact: true }).fill('Kept after reload')
  await page.reload()
  await expect(page.getByLabel('Menu name', { exact: true })).toHaveValue('Kept after reload')
  await expect(page.getByText(/Draft restored/)).toBeVisible()
})

test('an unconfirmed save freezes editing and retries the same payload', async ({ page }) => {
  await workspace(page)
  const saves = []
  const url = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
  await page.route(`${url}/functions/v1/menu-import`, async route => {
    const request = route.request()
    saves.push({ id: request.headers()['x-import-id'], body: request.postData() })
    if (saves.length === 1) await route.fulfill({ status: 503, json: { error: 'save_unavailable' } })
    else await route.fulfill({ json: { list_id: 'saved-menu' } })
  })
  await page.getByRole('button', { name: 'Try a sample' }).click()
  await page.getByRole('checkbox', { name: /checked the dish names/ }).check()
  await confirmAllergens(page)
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /allergens of every dish/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Retry saving this draft' })).toBeEnabled()
  await page.getByRole('button', { name: 'Retry saving this draft' }).click()
  await expect(page).toHaveURL(/\/lists\?structure_id=test-restaurant/)
  expect(saves).toHaveLength(2)
  expect(saves[0]).toEqual(saves[1])
})

test('published imports show every portion price and source-language fallback', async ({ page }) => {
  const url = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
  const source = menu()
  source.language = 'ro'
  source.categories[0].items[0].name = 'Paste cu roșii'
  source.categories[0].items[0].description = 'Roșii și busuioc'
  let index = 0
  const records = buildMenuRecords(source, 'restaurant', owner, () => `item-${index++}`)
  await page.route(`${url}/rest/v1/rpc/get_public_menu`, route => route.fulfill({ json: {
    structure: { title: 'Test restaurant', structure: { currency: '€', languages: ['en', 'ro'], language_main: 'en' } },
    list: { list_id: records.list.list_id, title: records.list.title, editModal: records.list.data.editModal },
    categories: records.categories.category.categories,
    products: Object.fromEntries(records.products.map(row => [row.category_id, row.product.products]))
  } }))
  await page.goto('/menu/import-test')
  await expect(page.getByRole('heading', { name: 'Paste cu roșii' })).toBeVisible()
  await expect(page.getByText('Roșii și busuioc', { exact: true })).toBeVisible()
  await expect(page.locator('.dish__price')).toHaveCount(2)
  await expect(page.locator('.dish__prices')).toContainText('12.50')
  await expect(page.locator('.dish__prices')).toContainText('18.00')
  await accessible(page)
})
