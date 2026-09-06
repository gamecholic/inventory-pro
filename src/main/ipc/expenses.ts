import { ipcMain } from 'electron'
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  listExpenseCategories,
  listExpenses,
  updateExpense,
  updateExpenseCategory
} from '../db/expenses'
import {
  expenseCategoryInput,
  expenseFilter,
  expenseId,
  expenseInput,
  updateExpenseCategoryInput,
  updateExpenseInput
} from '../../shared/expenses'

export function registerExpensesIpc(): void {
  ipcMain.handle('expenses:list', (_event, input: unknown) => listExpenses(expenseFilter.parse(input)))
  ipcMain.handle('expenses:create', (_event, input: unknown) => createExpense(expenseInput.parse(input)))
  ipcMain.handle('expenses:update', (_event, input: unknown) => {
    const { id, ...patch } = updateExpenseInput.parse(input)
    return updateExpense(id, expenseInput.parse(patch))
  })
  ipcMain.handle('expenses:delete', (_event, input: unknown) => {
    deleteExpense(expenseId.parse(input).id)
    return true
  })

  ipcMain.handle('expense-categories:list', () => listExpenseCategories())
  ipcMain.handle('expense-categories:create', (_event, input: unknown) =>
    createExpenseCategory(expenseCategoryInput.parse(input))
  )
  ipcMain.handle('expense-categories:update', (_event, input: unknown) => {
    const { id, ...patch } = updateExpenseCategoryInput.parse(input)
    return updateExpenseCategory(id, expenseCategoryInput.parse(patch))
  })
  ipcMain.handle('expense-categories:delete', (_event, input: unknown) => {
    deleteExpenseCategory(expenseId.parse(input).id)
    return true
  })
}
