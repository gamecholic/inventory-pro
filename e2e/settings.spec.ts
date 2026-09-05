import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'inventory-pro-e2e-'))
  app = await electron.launch({
    args: [join(process.cwd(), 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`]
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
})

test('settings language switch persists across reload (SQLite)', async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('tab', { name: 'General' })).toBeVisible()

  await page.locator('#language').click()
  await page.getByRole('option', { name: 'Türkçe' }).click()
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByRole('link', { name: 'Ayarlar' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('link', { name: 'Ayarlar' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Genel' })).toBeVisible()

  // Cleanup: back to English for other tests (UI is Turkish at this point).
  await page.getByRole('link', { name: 'Ayarlar' }).click()
  await page.locator('#language').click()
  await page.getByRole('option', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click()
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
})
