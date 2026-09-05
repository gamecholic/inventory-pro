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

test('theme menu switches appearance on first selection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByTitle('Toggle theme').click()
  await page.getByRole('menuitem', { name: 'Dark' }).click()
  await expect(page.locator('html.dark')).toBeAttached()
  await expect(page.getByRole('menu')).toBeHidden()
  await page.getByTitle('Toggle theme').click()
  await page.getByRole('menuitem', { name: 'Light' }).click()
  await expect(page.locator('html.dark')).toHaveCount(0)
})
