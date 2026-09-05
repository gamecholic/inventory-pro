import { test } from '@playwright/test'

test('shell visual', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/opencode/shell-light.png' })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/opencode/shell-dark.png' })
})
