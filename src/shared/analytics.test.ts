import { describe, expect, it } from 'vitest'
import { deadStockInput, rangeInput, topProductsInput } from './analytics'

const RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.999Z' }

describe('analytics inputs', () => {
  it('requires ISO datetimes for ranges', () => {
    expect(rangeInput.safeParse(RANGE).success).toBe(true)
    expect(rangeInput.safeParse({ from: '09/05/2026', to: RANGE.to }).success).toBe(false)
  })

  it('defaults top-products sort and limit, clamps limit', () => {
    const parsed = topProductsInput.parse(RANGE)
    expect(parsed.sort).toBe('revenue')
    expect(parsed.limit).toBe(10)
    expect(topProductsInput.safeParse({ ...RANGE, limit: 51 }).success).toBe(false)
  })

  it('defaults dead-stock window', () => {
    expect(deadStockInput.parse({}).days).toBe(60)
  })
})
