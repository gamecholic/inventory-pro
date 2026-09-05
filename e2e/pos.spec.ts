import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'inventory-pro-e2e-pos-'))
  app = await electron.launch({
    args: [join(process.cwd(), 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`]
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
})

test('cash sale: search → add → pay exact → receipt → stock decremented', async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() =>
    window.api.categories.create({ name: 'E2E Drinks', description: '' }).then((c) =>
      window.api.products.create({
        name: 'E2E Cola',
        barcode: '111222',
        categoryId: (c as { id: number }).id,
        unit: 'pcs',
        sellingPrice: 25,
        costPrice: 10,
        stockQty: 10,
        minStock: 5,
        supplierId: null,
        description: ''
      })
    )
  )

  await page.getByRole('link', { name: 'Point of Sale' }).click()
  await page.getByPlaceholder('Scan barcode or search products...').fill('cola')
  await page.getByRole('button', { name: /E2E Cola/ }).click()
  await expect(page.getByText('$25.00', { exact: true }).first()).toBeVisible()

  // Exact-barcode submit auto-adds a second unit and clears the search.
  await page.getByPlaceholder('Scan barcode or search products...').fill('111222')
  await page.keyboard.press('Enter')
  await expect(page.getByPlaceholder('Scan barcode or search products...')).toHaveValue('')

  await page.getByRole('button', { name: 'Cash Payment' }).click()
  await expect(page.getByText('Cash Payment').nth(1)).toBeVisible()
  await page.getByRole('button', { name: 'Complete Sale' }).click()

  // Receipt opens with a well-formed number; totals reflect 2 × $25.
  await expect(page.getByText(/INV-\d{8}-\d{6}/).first()).toBeVisible()
  await expect(page.getByText('$50.00').first()).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).first().click()

  // Cart cleared and stock decremented 10 → 8.
  await expect(page.getByText('No items in cart.')).toBeVisible()
  await expect(page.getByText('In Stock: 8 pcs')).toBeVisible()
})
