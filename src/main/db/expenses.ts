import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import {
  expenseCategoryInput,
  expenseFilter,
  expenseId,
  expenseInput,
  type ExpenseCategoryInput,
  type ExpenseCategoryRow,
  type ExpenseFilter,
  type ExpenseInput,
  type ExpenseRow
} from '../../shared/expenses'
import { toISO } from '../../shared/dates'
import { getDb } from './client'
import { expenseCategories, expenses } from './schema'

export function listExpenseCategories(): ExpenseCategoryRow[] {
  return getDb().select().from(expenseCategories).orderBy(expenseCategories.name).all()
}

export function createExpenseCategory(input: ExpenseCategoryInput): ExpenseCategoryRow {
  const parsed = expenseCategoryInput.parse(input)
  const now = toISO(new Date())
  const id = getDb()
    .insert(expenseCategories)
    .values({ name: parsed.name, description: parsed.description || null, createdAt: now })
    .run().lastInsertRowid as number
  const row = getDb().select().from(expenseCategories).where(eq(expenseCategories.id, id)).get()
  if (!row) throw new Error('Category not found after save')
  return row
}

export function updateExpenseCategory(id: number, input: ExpenseCategoryInput): ExpenseCategoryRow {
  const parsed = expenseCategoryInput.parse(input)
  expenseId.parse({ id })
  getDb()
    .update(expenseCategories)
    .set({ name: parsed.name, description: parsed.description || null })
    .where(eq(expenseCategories.id, id))
    .run()
  const row = getDb().select().from(expenseCategories).where(eq(expenseCategories.id, id)).get()
  if (!row) throw new Error('Category not found after save')
  return row
}

/** Deleting a used category unlinks its expenses (they become Other). */
export function deleteExpenseCategory(id: number): void {
  expenseId.parse({ id })
  const db = getDb()
  db.update(expenses).set({ categoryId: null }).where(eq(expenses.categoryId, id)).run()
  db.delete(expenseCategories).where(eq(expenseCategories.id, id)).run()
}

/** Features §7.4–§7.6 — filtered list, newest first. Search covers description/recipient/reference/notes. */
export function listExpenses(filter: ExpenseFilter): ExpenseRow[] {
  const f = expenseFilter.parse(filter)
  const db = getDb()
  const conditions = [gte(expenses.date, f.from), lte(expenses.date, f.to)]
  if (f.categoryId !== null) conditions.push(eq(expenses.categoryId, f.categoryId))
  if (f.payment !== 'all') conditions.push(eq(expenses.paymentMethod, f.payment))
  if (f.search.trim() !== '') {
    const q = `%${f.search.trim().toLowerCase()}%`
    conditions.push(
      sql`lower(${expenses.description}) LIKE ${q} OR lower(${expenses.recipient}) LIKE ${q} OR lower(${expenses.reference}) LIKE ${q} OR lower(${expenses.notes}) LIKE ${q}`
    )
  }
  return db
    .select({
      id: expenses.id,
      date: expenses.date,
      amount: expenses.amount,
      description: expenses.description,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      paymentMethod: expenses.paymentMethod,
      recipient: expenses.recipient,
      reference: expenses.reference,
      notes: expenses.notes
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.date))
    .all()
}

export function createExpense(input: ExpenseInput): ExpenseRow {
  const parsed = expenseInput.parse(input)
  const now = toISO(new Date())
  const id = getDb()
    .insert(expenses)
    .values({
      date: parsed.date,
      amount: parsed.amount,
      description: parsed.description,
      categoryId: parsed.categoryId,
      paymentMethod: parsed.paymentMethod,
      recipient: parsed.recipient || null,
      reference: parsed.reference || null,
      notes: parsed.notes || null,
      createdAt: now,
      updatedAt: now
    })
    .run().lastInsertRowid as number
  return requireExpense(id)
}

export function updateExpense(id: number, input: ExpenseInput): ExpenseRow {
  const parsed = expenseInput.parse(input)
  expenseId.parse({ id })
  getDb()
    .update(expenses)
    .set({
      date: parsed.date,
      amount: parsed.amount,
      description: parsed.description,
      categoryId: parsed.categoryId,
      paymentMethod: parsed.paymentMethod,
      recipient: parsed.recipient || null,
      reference: parsed.reference || null,
      notes: parsed.notes || null,
      updatedAt: toISO(new Date())
    })
    .where(eq(expenses.id, id))
    .run()
  return requireExpense(id)
}

export function deleteExpense(id: number): void {
  expenseId.parse({ id })
  getDb().delete(expenses).where(eq(expenses.id, id)).run()
}

function requireExpense(id: number): ExpenseRow {
  const row = getDb()
    .select({
      id: expenses.id,
      date: expenses.date,
      amount: expenses.amount,
      description: expenses.description,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      paymentMethod: expenses.paymentMethod,
      recipient: expenses.recipient,
      reference: expenses.reference,
      notes: expenses.notes
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(eq(expenses.id, id))
    .get()
  if (!row) throw new Error('Expense not found after save')
  return row
}
