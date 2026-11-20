import { expect, test, api } from './fixtures'

const CATEGORY = 'E2E Beverages'
const SEEDED_CATEGORY = 'E2E Beverages Seed'
const PRODUCT = 'E2E Cola'

test.beforeAll(async ({ appUrl }) => {
  // Test 2 needs a category to exist independently of test 1's UI flow.
  await api(appUrl, 'categories:create', { name: SEEDED_CATEGORY, description: '' })
})

test('category + product create → archive → restore flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Products' }).click()
  await expect(page.getByRole('button', { name: 'Add Product' })).toBeVisible()

  // Category first (required for products).
  await page.getByRole('tab', { name: 'Categories' }).click()
  await page.getByRole('button', { name: 'Add Category' }).click()
  await page.locator('#catName').fill(CATEGORY)
  await page.getByRole('button', { name: 'Save Category' }).click()
  await expect(page.getByRole('cell', { name: CATEGORY, exact: true })).toBeVisible()

  // Create product.
  await page.getByRole('tab', { name: 'Product List' }).click()
  await page.getByRole('button', { name: 'Add Product' }).click()
  await page.locator('#pName').fill(PRODUCT)
  await page.locator('#pCategory').click()
  await page.getByRole('option', { name: CATEGORY, exact: true }).click()
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
  await page.getByTitle('Restore this product?').filter({ visible: true }).first().click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.locator('#fStatus').click()
  await page.getByRole('option', { name: 'Active Products' }).click()
  await expect(page.getByRole('cell', { name: PRODUCT })).toBeVisible()
})

test('duplicate barcode is rejected with a message', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Products' }).click()
  const create = async (name: string): Promise<void> => {
    await page.getByRole('button', { name: 'Add Product' }).click()
    await page.locator('#pName').fill(name)
    await page.locator('#pCategory').click()
    await page.getByRole('option', { name: SEEDED_CATEGORY }).first().click()
    await page.locator('#pBarcode').fill('DUP-001')
    await page.locator('#pSell').fill('10')
    await page.getByRole('button', { name: 'Save Product' }).click()
  }
  await create('E2E Dup One')
  await expect(page.getByRole('cell', { name: 'E2E Dup One' })).toBeVisible()
  await create('E2E Dup Two')
  await expect(page.getByText(/already used/)).toBeVisible()
})
