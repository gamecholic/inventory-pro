import { describe, expect, it } from 'vitest'
import { computeAdjustment, normalizeReason, stockAdjustInput } from './stock'

describe('stockAdjustInput', () => {
  it('requires a positive whole quantity', () => {
    const base = { productId: 1, type: 'add' } as const
    expect(stockAdjustInput.safeParse({ ...base, quantity: 0 }).success).toBe(false)
    expect(stockAdjustInput.safeParse({ ...base, quantity: 1.5 }).success).toBe(false)
    expect(stockAdjustInput.safeParse({ ...base, quantity: 3 }).success).toBe(true)
  })
})

describe('computeAdjustment', () => {
  it('averages cost on add', () => {
    // 10 @ 5.00 + 10 @ 15.00 → 20 @ 10.00
    const p = computeAdjustment({ stockQty: 10, costPrice: 5 }, { type: 'add', quantity: 10, newCostPrice: 15 })
    expect(p.newQty).toBe(20)
    expect(p.newCost).toBeCloseTo(10, 10)
    expect(p.newValue).toBeCloseTo(200, 10)
    expect(p.currentValue).toBe(50)
  })

  it('keeps current cost when adding at same cost', () => {
    const p = computeAdjustment({ stockQty: 4, costPrice: 7 }, { type: 'add', quantity: 2, newCostPrice: null })
    expect(p.newQty).toBe(6)
    expect(p.newCost).toBeCloseTo(7, 10)
  })

  it('floors remove at zero and keeps cost', () => {
    const p = computeAdjustment({ stockQty: 3, costPrice: 7 }, { type: 'remove', quantity: 10, newCostPrice: null })
    expect(p.newQty).toBe(0)
    expect(p.newCost).toBe(7)
    expect(p.newValue).toBe(0)
  })
})

describe('normalizeReason', () => {
  it('defaults empty reasons', () => {
    expect(normalizeReason('')).toBe('Stock adjustment')
    expect(normalizeReason('  ')).toBe('Stock adjustment')
    expect(normalizeReason('Damaged')).toBe('Damaged')
  })
})
