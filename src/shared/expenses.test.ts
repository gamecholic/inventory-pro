import { describe, expect, it } from 'vitest'
import { categoryColor, expenseFilter, expenseInput } from './expenses'

describe('expenseInput', () => {
  const valid = { date: new Date().toISOString(), amount: 25.5, description: 'Rent' }

  it('fills payment and category defaults', () => {
    const parsed = expenseInput.parse(valid)
    expect(parsed.paymentMethod).toBe('cash')
    expect(parsed.categoryId).toBeNull()
  })

  it('rejects zero amount and blank description', () => {
    expect(expenseInput.safeParse({ ...valid, amount: 0 }).success).toBe(false)
    expect(expenseInput.safeParse({ ...valid, amount: -3 }).success).toBe(false)
    expect(expenseInput.safeParse({ ...valid, description: '  ' }).success).toBe(false)
  })
})

describe('expenseFilter', () => {
  it('parses ISO ranges with defaults', () => {
    const now = new Date().toISOString()
    const parsed = expenseFilter.parse({ from: now, to: now })
    expect(parsed.payment).toBe('all')
    expect(parsed.categoryId).toBeNull()
  })
})

describe('categoryColor', () => {
  it('is stable, theme-token based, and grey for uncategorized', () => {
    expect(categoryColor(3)).toBe(categoryColor(3))
    expect(categoryColor(3)).toMatch(/^var\(--chart-[1-5]\)$/)
    expect(categoryColor(null)).toBe('var(--muted-foreground)')
  })
})
