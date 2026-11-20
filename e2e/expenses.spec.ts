import { expect, test, api } from './fixtures'

test.beforeAll(async ({ appUrl }) => {
  const category = await api<{ id: number }>(appUrl, 'expense-categories:create', {
    name: 'E2E Rent',
    description: ''
  })
  await api(appUrl, 'expenses:create', {
    date: new Date().toISOString(),
    amount: 100,
    description: 'E2E Shop Rent',
    categoryId: category.id,
    paymentMethod: 'bank',
    recipient: '',
    reference: '',
    notes: ''
  })
})

test('expenses list, summary, edit and delete', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Expenses' }).click()
  await expect(page.getByRole('cell', { name: 'E2E Shop Rent' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '$100.00' })).toBeVisible()

  // Edit amount via UI → summary total follows.
  await page.getByRole('row', { name: /E2E Shop Rent/ }).getByRole('button').first().click()
  await page.locator('#expAmount').fill('150')
  await page.getByRole('button', { name: 'Update Expense' }).click()
  await expect(page.getByText('$150.00').filter({ visible: true }).first()).toBeVisible()

  // Delete with confirmation → empty state.
  await page.getByRole('row', { name: /E2E Shop Rent/ }).getByRole('button').nth(1).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('No expenses found.')).toBeVisible()
})
