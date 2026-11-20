import { expect, test, api } from './fixtures'

let productId = 0

test.beforeAll(async ({ appUrl }) => {
  const category = await api<{ id: number }>(appUrl, 'categories:create', {
    name: 'E2E Sales',
    description: ''
  })
  const product = await api<{ id: number }>(appUrl, 'products:create', {
    name: 'E2E Widget',
    barcode: '',
    categoryId: category.id,
    unit: 'pcs',
    sellingPrice: 40,
    costPrice: 15,
    stockQty: 10,
    minStock: 5,
    supplierId: null,
    description: ''
  })
  productId = product.id
  await api(appUrl, 'sales:complete', {
    lines: [{ productId: product.id, qty: 2 }],
    discount: { type: 'fixed', value: 0 },
    paymentMethod: 'card',
    cashAmount: null,
    cardAmount: null
  })
})

test('sales list → details → cancel restores stock', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Sales History' }).click()
  await expect(page.getByText('$80.00').first()).toBeVisible()

  await page.getByRole('button', { name: 'View Details' }).first().click()
  await expect(page.getByText('Sale Details')).toBeVisible()
  await expect(page.getByText('E2E Widget')).toBeVisible()

  // Print reuses the POS receipt dialog.
  await page.getByRole('button', { name: 'Print Receipt', exact: true }).click()
  await expect(page.getByText(/INV-\d{8}-\d{6}/).first()).toBeVisible()
  // Wait until focus is trapped inside the topmost dialog so Escape
  // deterministically dismisses only the receipt overlay, not the panel.
  await page.waitForFunction(() => {
    const el = document.activeElement as Element | null
    return !!el?.closest?.('[role="dialog"]')
  })
  await page.keyboard.press('Escape')
  // Receipt overlay (panel also has a Print Receipt button) must be gone before
  // the panel underneath is clickable again.
  await expect(page.getByRole('button', { name: 'Print Receipt', exact: true })).toHaveCount(1)

  // Cancel returns 2 units to stock: 8 → 10.
  await page.getByRole('button', { name: 'Cancel Sale' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Canceled').first()).toBeVisible()

  const stock = await page.evaluate(
    (id) => window.api.products.search('E2E Widget', 10).then((rows) => rows.find((r) => r.id === id)?.stockQty),
    productId
  )
  expect(stock).toBe(10)

  // Return button is present but disabled (features §6.5).
  await expect(page.getByRole('button', { name: 'Process Return' })).toBeDisabled()
})
