import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'

let app: ElectronApplication
let page: Page
let productId = 0

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'inventory-pro-e2e-sales-'))
  app = await electron.launch({
    args: [join(process.cwd(), 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`]
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  productId = await page.evaluate(() =>
    window.api.categories.create({ name: 'E2E Sales', description: '' }).then((c) =>
      window.api.products
        .create({
          name: 'E2E Widget',
          barcode: '',
          categoryId: (c as { id: number }).id,
          unit: 'pcs',
          sellingPrice: 40,
          costPrice: 15,
          stockQty: 10,
          minStock: 5,
          supplierId: null,
          description: ''
        })
        .then((p) =>
          window.api.sales
            .complete({
              lines: [{ productId: (p as { id: number }).id, qty: 2 }],
              discount: { type: 'fixed', value: 0 },
              paymentMethod: 'card',
              cashAmount: null,
              cardAmount: null
            })
            .then(() => (p as { id: number }).id)
        )
    )
  )
})

test.afterAll(async () => {
  await app.close()
})

test('sales list → details → cancel restores stock', async () => {
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

  const stock = await page.evaluate((id) =>
    window.api.products.search('E2E Widget', 10).then((rows) => rows.find((r) => r.id === id)?.stockQty)
  , productId)
  expect(stock).toBe(10)

  // Return button is present but disabled (features §6.5).
  await expect(page.getByRole('button', { name: 'Process Return' })).toBeDisabled()
})
