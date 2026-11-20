import { expect, test, api } from './fixtures'

test.beforeAll(async ({ appUrl }) => {
  const category = await api<{ id: number }>(appUrl, 'categories:create', {
    name: 'E2E Rep',
    description: ''
  })
  const product = await api<{ id: number }>(appUrl, 'products:create', {
    name: 'E2E Rep Cola',
    barcode: '',
    categoryId: category.id,
    unit: 'pcs',
    sellingPrice: 50,
    costPrice: 20,
    stockQty: 100,
    minStock: 5,
    supplierId: null,
    description: ''
  })
  await api(appUrl, 'sales:complete', {
    lines: [{ productId: product.id, qty: 2 }],
    discount: { type: 'fixed', value: 0 },
    paymentMethod: 'cash',
    cashAmount: 100,
    cardAmount: null
  })
})

test('reports generate across types', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Reports' }).click()

  // Default financial report for the current month shows the seeded sale.
  await expect(page.getByText('$100.00').first()).toBeVisible()
  await expect(page.getByText('$60.00').first()).toBeVisible()

  // Top products reuses the same backend with its own controls.
  await page.getByRole('tab', { name: 'Top Products' }).click()
  await expect(page.getByRole('cell', { name: 'E2E Rep Cola' })).toBeVisible()

  // Reorder insight needs no range.
  await page.getByRole('tab', { name: 'Reorder Alerts' }).click()
  await expect(page.getByRole('cell', { name: 'E2E Rep Cola' })).toBeVisible()
})
