import { z } from 'zod'
import { isoDateTime } from './api'

/** Features §7.2 — receipt-less expense payment methods (no split here). */
export const EXPENSE_PAYMENTS = ['cash', 'card', 'bank', 'check', 'other'] as const
export type ExpensePayment = (typeof EXPENSE_PAYMENTS)[number]

export const expenseInput = z.object({
  date: isoDateTime,
  amount: z.number().positive(),
  description: z.string().trim().min(1).max(500),
  categoryId: z.number().int().positive().nullable().default(null),
  paymentMethod: z.enum(EXPENSE_PAYMENTS).default('cash'),
  recipient: z.string().trim().max(200).default(''),
  reference: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(2000).default('')
})
export type ExpenseInput = z.infer<typeof expenseInput>

export const expenseId = z.object({ id: z.number().int().positive() })
export const updateExpenseInput = expenseInput.extend({ id: z.number().int().positive() })

export const expenseCategoryInput = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default('')
})
export type ExpenseCategoryInput = z.infer<typeof expenseCategoryInput>
export const updateExpenseCategoryInput = expenseCategoryInput.extend({ id: z.number().int().positive() })

/** Features §7.4. Custom range commits via Apply; presets set the draft. */
export const expenseFilter = z.object({
  from: isoDateTime,
  to: isoDateTime,
  categoryId: z.number().int().positive().nullable().default(null),
  payment: z.enum(['all', ...EXPENSE_PAYMENTS]).default('all'),
  search: z.string().max(200).default('')
})
export type ExpenseFilter = z.infer<typeof expenseFilter>

export interface ExpenseCategoryRow {
  id: number
  name: string
  description: string | null
}

export interface ExpenseRow {
  id: number
  date: string
  amount: number
  description: string
  categoryId: number | null
  categoryName: string | null
  paymentMethod: string
  recipient: string | null
  reference: string | null
  notes: string | null
}

/**
 * Stable badge color per category id. Theme tokens (not hex) so badges work in
 * dark/light mode (docs/ui.md §1).
 */
export function categoryColor(id: number | null): string {
  if (id === null) return 'var(--muted-foreground)'
  return `var(--chart-${(Math.abs(id) % 5) + 1})`
}
