import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import process from 'node:process'

const expectAccessible = async (page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  const blockers = violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')
  expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([])
}

test('a visitor can inspect a published menu and recover from a bad link', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Publish a menu')
  await expectAccessible(page)

  const menuLink = page.getByRole('link', { name: /Trattoria Mareluna/ }).first()
  await expect(menuLink).toHaveAttribute('href', '/menu/trattoria-mareluna')
  await page.goto(await menuLink.getAttribute('href'))
  await expect(page.getByRole('heading', { level: 1, name: 'Trattoria Mareluna' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Antipasti' })).toBeVisible()
  await expectAccessible(page)

  await page.goto('/this-page-does-not-exist')
  await expect(page.getByRole('heading', { name: 'That page is not on the menu.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to homepage' })).toHaveAttribute('href', '/')
  await expectAccessible(page)
})

test('the one-click demo reaches its private workspace', async ({ page }) => {
  test.skip(!process.env.VITE_DEMO_EMAIL || !process.env.VITE_DEMO_PASSWORD, 'Demo credentials are not configured')

  await page.goto('/login')
  await page.getByRole('button', { name: 'Enter demo' }).click()
  await expect(page).toHaveURL(/\/structures(?:\?.*)?$/, { timeout: 15000 })
  await expect(page.getByText('My menus', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add menu' })).toBeVisible()
  await expectAccessible(page)
})
