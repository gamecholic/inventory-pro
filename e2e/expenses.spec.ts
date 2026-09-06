import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'inventory-pro-e2e-expenses-'))
  app = await electron.launch({
    args: [join(process.cwd(), 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`]
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() =>
    window.api.expenseCategories.create({ name: 'E2E Rent', description: '' }).then((c) =>
      window.api.expenses.create({
        date: new Date().toISOString(),
        amount: 100,
        description: 'E2E Shop Rent',
        categoryId: (c as { id: number }).id,
        paymentMethod: 'bank',
        recipient: '',
        reference: '',
        notes: ''
      })
    )
  )
})

test.afterAll(async () => {
  await app.close()
})

test('expenses list, summary, edit and delete', async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Expenses' }).click()
  await expect(page.getByRole('cell', { name: 'E2E Shop Rent' })).toBeVisible()
  await expect(page.getByText('$100.00').first()).toBeVisible()

  // Edit amount via UI → summary total follows.
  await page.getByRole('row', { name: /E2E Shop Rent/ }).getByRole('button').first().click()
  await page.locator('#expAmount').fill('150')
  await page.getByRole('button', { name: 'Update Expense' }).click()
  await expect(page.getByText('$150.00').first()).toBeVisible()

  // Delete with confirmation → empty state.
  await page.getByRole('row', { name: /E2E Shop Rent/ }).getByRole('button').nth(1).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('No expenses found.')).toBeVisible()
})
