import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { ExpenseCategoryInput, ExpenseFilter, ExpenseInput } from '@shared/expenses'

export const expensesKey = (filter: ExpenseFilter) => ['expenses', filter] as const
export const expenseCategoriesKey = ['expense-categories'] as const

function useInvalidateExpenses() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    void queryClient.invalidateQueries({ queryKey: expenseCategoriesKey })
  }
}

function useExpenseMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, successKey: string) {
  const { t } = useTranslation()
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate()
      toast.success(t(successKey))
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('expenses.actionFailed'))
    }
  })
}

/** Filtered expense list (features §7.4–§7.6). No pagination — full filtered set for summaries. */
export function useExpenses(filter: ExpenseFilter) {
  return useQuery({ queryKey: expensesKey(filter), queryFn: () => window.api.expenses.list(filter) })
}

export function useCreateExpense() {
  return useExpenseMutation((input: ExpenseInput) => window.api.expenses.create(input), 'expenses.created')
}

export function useUpdateExpense() {
  return useExpenseMutation(
    ({ id, input }: { id: number; input: ExpenseInput }) => window.api.expenses.update(id, input),
    'expenses.updated'
  )
}

export function useDeleteExpense() {
  return useExpenseMutation((id: number) => window.api.expenses.remove(id), 'expenses.deleted')
}

export function useExpenseCategories() {
  return useQuery({ queryKey: expenseCategoriesKey, queryFn: () => window.api.expenseCategories.list() })
}

export function useCreateExpenseCategory() {
  return useExpenseMutation(
    (input: ExpenseCategoryInput) => window.api.expenseCategories.create(input),
    'expenses.created'
  )
}

export function useUpdateExpenseCategory() {
  return useExpenseMutation(
    ({ id, input }: { id: number; input: ExpenseCategoryInput }) =>
      window.api.expenseCategories.update(id, input),
    'expenses.updated'
  )
}

export function useDeleteExpenseCategory() {
  return useExpenseMutation((id: number) => window.api.expenseCategories.remove(id), 'expenses.deleted')
}
