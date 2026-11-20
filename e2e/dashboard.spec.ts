import { expect, test, api } from './fixtures'

test.beforeAll(async ({ appUrl }) => {
  const category = await api<{ id: number }>(appUrl, 'categories:create', {
    name: 'E2E Dash',
    description: ''
  })
  const product = await api<{ id: number }>(appUrl, 'products:create', {
    name: 'E2E Dash Cola',
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

test('dashboard landing shows metrics and top products', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  // Seeding bypasses TanStack invalidation (no IPC mutation ran in-app),
  // so reload for a fresh mount like a real user would see.
  await page.reload()
  await expect(page.getByText('Monthly Revenue')).toBeVisible()
  await expect(page.getByText('$100.00').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Revenue & Profit Trend' })).toBeVisible()
  await expect(page.getByText('Total Products: 1')).toBeVisible()
})
