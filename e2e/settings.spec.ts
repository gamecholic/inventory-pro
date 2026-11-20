import { expect, test } from './fixtures'

test('settings language switch persists across reload (SQLite)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('tab', { name: 'General' })).toBeVisible()

  await page.locator('#language').click()
  await page.getByRole('option', { name: 'Türkçe' }).click()
  // Spec §1.2: language applies immediately and persists without Save.
  await expect(page.getByRole('link', { name: 'Ayarlar' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('link', { name: 'Ayarlar' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Genel' })).toBeVisible()

  // Cleanup: back to English for other tests (UI is Turkish at this point).
  await page.getByRole('link', { name: 'Ayarlar' }).click()
  await page.locator('#language').click()
  await page.getByRole('option', { name: 'English' }).click()
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
})
