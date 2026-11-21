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

test('stock in: enter a purchase and read the new average cost', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Stock Update' }).click()

  // 5.1 — the page opens on the scan/search field; picking replaces it.
  await page.getByPlaceholder(/Scan a barcode or type a product name/).fill('flour')
  await page.getByRole('button', { name: /E2E Flour/ }).click()

  // 5.2 — the invoice total is the input; the unit cost is derived.
  // 3 @ 10.00 + 10 @ 15.00 → 13 @ 13.85
  await page.locator('#stock-qty').fill('10')
  await page.locator('#stock-amount').fill('150')
  await expect(page.getByText('= $15.00 per kg')).toBeVisible()

  // 5.3/5.4 — the answer and the projected chart point update live.
  await expect(page.getByText('$13.85').first()).toBeVisible()
  await expect(page.getByText('3 → 13 kg')).toBeVisible()
  await expect(page.getByText('Dashed line: where this purchase puts your cost.')).toBeVisible()

  await page.getByRole('button', { name: 'Save purchase' }).click()

  // Selection stays: chip, answer and history show the saved state.
  await expect(page.getByText('13 kg').first()).toBeVisible()
  await expect(page.getByText('$13.85').first()).toBeVisible()
  await expect(page.getByText('Price History')).toBeVisible()
})

test('correction sheet removes units without touching cost', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Stock Update' }).click()
  await page.getByPlaceholder(/Scan a barcode or type a product name/).fill('flour')
  await page.getByRole('button', { name: /E2E Flour/ }).click()

  await page.getByRole('button', { name: 'Correct stock', exact: true }).click()
  await page.getByRole('button', { name: 'Damaged' }).click()
  await page.locator('#correct-qty').fill('2')
  await page.getByRole('button', { name: 'Remove stock' }).click()

  // 13 → 11 kg; the average cost is untouched.
  await expect(page.getByText('11 kg').first()).toBeVisible()
})
