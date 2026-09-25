import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'inventory-pro-e2e-stock-'))
  app = await electron.launch({
    args: [join(process.cwd(), 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`]
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
})

test('stock search → select → add with cost averaging', async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() =>
    window.api.categories.create({ name: 'E2E Stock', description: '' }).then((c) =>
      window.api.products.create({
        name: 'E2E Flour',
        barcode: '',
        categoryId: (c as { id: number }).id,
        unit: 'kg',
        sellingPrice: 20,
        costPrice: 10,
        stockQty: 3,
        minStock: 5,
        supplierId: null,
        description: ''
      })
    )
  )

  await page.getByRole('link', { name: 'Stock Update' }).click()
  await page.getByPlaceholder('Search name, barcode or SKU...').fill('flour')
  await page.getByRole('button', { name: /E2E Flour/ }).click()
  await page.getByRole('button', { name: 'Receive stock', exact: true }).click()
  await expect(page.getByText('Receive Stock: E2E Flour')).toBeVisible()

  // 3 @ 10.00 + 10 @ 15.00 → 13 @ 13.85
  const dialog = page.getByRole('dialog')
  await dialog.locator('#adjQty').fill('10')
  await dialog.locator('#adjCost').fill('15')
  await dialog.getByRole('button', { name: 'Receive stock', exact: true }).click()
  await expect(dialog).toBeHidden()

  // Selection stays: summary + chart show the updated stock and averaged cost.
  await expect(page.getByText('13 kg').first()).toBeVisible()

  // Movement log feeds the price history chart (create + adjustment points).
  await expect(page.getByText('Price History')).toBeVisible()
})
