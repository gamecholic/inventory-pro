import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'

let app: ElectronApplication
let page: Page

const CATEGORY = 'E2E Beverages'
const PRODUCT = 'E2E Cola'

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'inventory-pro-e2e-products-'))
  app = await electron.launch({
    args: [join(process.cwd(), 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`]
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
})

test('product create → archive → restore flow', async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Products' }).click()
  await expect(page.getByRole('button', { name: 'Add Product' })).toBeVisible()

  // Category first (required for products).
  await page.getByRole('tab', { name: 'Categories' }).click()
  await page.getByRole('button', { name: 'Add Category' }).click()
  await page.locator('#catName').fill(CATEGORY)
  await page.getByRole('button', { name: 'Save Category' }).click()
  await expect(page.getByRole('cell', { name: CATEGORY })).toBeVisible()

  // Create product.
  await page.getByRole('tab', { name: 'Product List' }).click()
  await page.getByRole('button', { name: 'Add Product' }).click()
  await page.locator('#pName').fill(PRODUCT)
  await page.locator('#pCategory').click()
  await page.getByRole('option', { name: CATEGORY }).click()
  await page.locator('#pSell').fill('25')
  await page.locator('#pCost').fill('10')
  await page.getByRole('button', { name: 'Save Product' }).click()
  await expect(page.getByRole('cell', { name: PRODUCT })).toBeVisible()

  // Archive → gone from Active.
  const row = page.getByRole('row', { name: new RegExp(PRODUCT) })
  await row.getByTitle('Archive this product?').click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('cell', { name: PRODUCT })).toHaveCount(0)

  // Deleted view shows it struck-through with restore action.
  await page.locator('#fStatus').click()
  await page.getByRole('option', { name: 'Deleted Products' }).click()
  await expect(page.getByRole('cell', { name: new RegExp(PRODUCT) })).toBeVisible()

  // Restore → back in Active.
  await page.getByTitle('Restore this product?').click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.locator('#fStatus').click()
  await page.getByRole('option', { name: 'Active Products' }).click()
  await expect(page.getByRole('cell', { name: PRODUCT })).toBeVisible()
})
