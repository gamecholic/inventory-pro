import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'inventory-pro-e2e-dash-'))
  app = await electron.launch({
    args: [join(process.cwd(), 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`]
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() =>
    window.api.categories.create({ name: 'E2E Dash', description: '' }).then((c) =>
      window.api.products
        .create({
          name: 'E2E Dash Cola',
          barcode: '',
          categoryId: (c as { id: number }).id,
          unit: 'pcs',
          sellingPrice: 50,
          costPrice: 20,
          stockQty: 100,
          minStock: 5,
          supplierId: null,
          description: ''
        })
        .then((p) =>
          window.api.sales.complete({
            lines: [{ productId: (p as { id: number }).id, qty: 2 }],
            discount: { type: 'fixed', value: 0 },
            paymentMethod: 'cash',
            cashAmount: 100,
            cardAmount: null
          })
        )
    )
  )
})

test.afterAll(async () => {
  await app.close()
})

test('dashboard landing shows metrics and top products', async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  // Seeding bypasses TanStack invalidation (no IPC mutation ran in-app),
  // so reload for a fresh mount like a real user would see.
  await page.reload()
  // Dashboard is the landing route.
  await expect(page.getByText('Monthly Revenue')).toBeVisible()
  await expect(page.getByText('$100.00').first()).toBeVisible()
  await expect(page.getByText('Top Selling Products')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'E2E Dash Cola' })).toBeVisible()
})
