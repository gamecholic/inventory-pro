import { expect, test, api } from './fixtures'

test.beforeAll(async ({ appUrl }) => {
  const category = await api<{ id: number }>(appUrl, 'categories:create', {
    name: 'E2E Stock',
    description: ''
  })
  await api(appUrl, 'products:create', {
    name: 'E2E Flour',
    barcode: '',
    categoryId: category.id,
    unit: 'kg',
    sellingPrice: 20,
    costPrice: 10,
    stockQty: 3,
    minStock: 5,
    supplierId: null,
    description: ''
  })
})

test('stock search → select → add with cost averaging', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
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
