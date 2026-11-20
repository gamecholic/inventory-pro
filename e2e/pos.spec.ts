import { expect, test, api } from './fixtures'
import type { Page } from '@playwright/test'

test.beforeAll(async ({ appUrl }) => {
  const category = await api<{ id: number }>(appUrl, 'categories:create', {
    name: 'E2E Drinks',
    description: ''
  })
  await api(appUrl, 'products:create', {
    name: 'E2E Cola',
    barcode: '111222',
    categoryId: category.id,
    unit: 'pcs',
    sellingPrice: 25,
    costPrice: 10,
    stockQty: 10,
    minStock: 5,
    supplierId: null,
    description: ''
  })
})

test('cash sale: search → add → pay exact → receipt → stock decremented', async ({ page }: { page: Page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
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
  await expect(page.getByText('8 pcs')).toBeVisible()
})

test('narrow window: cart stacks below the product grid instead of overlapping it', async ({ page }: { page: Page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.getByRole('link', { name: 'Point of Sale' }).click()
  await page.getByPlaceholder('Scan barcode or search products...').fill('cola')
  await page.getByRole('button', { name: /E2E Cola/ }).click()

  const grid = await page.getByTestId('product-grid').boundingBox()
  const cartTitle = await page.getByRole('button', { name: /Current Sale/ }).boundingBox()
  expect(grid).not.toBeNull()
  expect(cartTitle).not.toBeNull()
  // The cart header must start below the grid, never underneath it.
  expect(cartTitle!.y).toBeGreaterThanOrEqual(grid!.y + grid!.height!)

  // On a narrow viewport the cart is a collapsed bar; expand it before
  // checking that the pay buttons are reachable in the single-column layout.
  await page.getByRole('button', { name: /Current Sale/ }).click()
  const pay = page.getByRole('button', { name: 'Cash Payment' })
  await pay.scrollIntoViewIfNeeded()
  await expect(pay).toBeInViewport()
})
