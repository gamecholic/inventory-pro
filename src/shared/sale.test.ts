import { describe, expect, it } from 'vitest'
import {
  cartSubtotal,
  computeChange,
  computeDiscount,
  computeShortfall,
  receiptNo
} from './sale'

describe('computeDiscount', () => {
  it('returns 0 for empty/invalid/negative input', () => {
    expect(computeDiscount(100, { type: 'fixed', value: 0 })).toBe(0)
    expect(computeDiscount(100, { type: 'fixed', value: -5 })).toBe(0)
    expect(computeDiscount(100, { type: 'percent', value: NaN })).toBe(0)
    expect(computeDiscount(0, { type: 'fixed', value: 10 })).toBe(0)
  })

  it('caps percent at 100%', () => {
    expect(computeDiscount(100, { type: 'percent', value: 10 })).toBe(10)
    expect(computeDiscount(100, { type: 'percent', value: 100 })).toBe(100)
    expect(computeDiscount(100, { type: 'percent', value: 150 })).toBe(100)
  })

  it('caps fixed at subtotal', () => {
    expect(computeDiscount(100, { type: 'fixed', value: 30 })).toBe(30)
    expect(computeDiscount(100, { type: 'fixed', value: 150 })).toBe(100)
  })

  it('handles set-total', () => {
    expect(computeDiscount(100, { type: 'settotal', value: 80 })).toBe(20)
    expect(computeDiscount(100, { type: 'settotal', value: 100 })).toBe(0)
    expect(computeDiscount(100, { type: 'settotal', value: 120 })).toBe(0)
  })
})

describe('cartSubtotal / change / shortfall', () => {
  it('sums line totals', () => {
    expect(
      cartSubtotal([
        { qty: 2, unitPrice: 25 },
        { qty: 1, unitPrice: 10.5 }
      ])
    ).toBeCloseTo(60.5, 10)
  })

  it('floors change and shortfall at zero', () => {
    expect(computeChange(120, 100)).toBe(20)
    expect(computeChange(80, 100)).toBe(0)
    expect(computeShortfall(80, 100)).toBe(20)
    expect(computeShortfall(120, 100)).toBe(0)
  })
})

describe('receiptNo', () => {
  it('formats INV-YYYYMMDD-HHmmss', () => {
    expect(receiptNo(new Date(2026, 1, 11, 14, 30, 22))).toBe('INV-20260211-143022')
  })

  it('suffixes same-second collisions', () => {
    expect(receiptNo(new Date(2026, 1, 11, 14, 30, 22), 2)).toBe('INV-20260211-143022-2')
  })
})
