import { expect, test } from '@playwright/test'

test('shell visual', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/opencode/shell-light.png' })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/opencode/shell-dark.png' })
})

test('theme select on settings page switches appearance', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/#/settings')
  await page.locator('#theme').click()
  await page.getByRole('option', { name: 'Dark' }).click()
  await expect(page.locator('html.dark')).toBeAttached()
  await page.locator('#theme').click()
  await page.getByRole('option', { name: 'Light' }).click()
  await expect(page.locator('html.dark')).toHaveCount(0)
})
