import { describe, expect, it } from 'vitest'
import { formatMoney, round2 } from './money'

describe('round2', () => {
  it('rounds repeating decimals to cents', () => {
    expect(round2(71.66666666666667)).toBe(71.67)
    expect(round2(10.005)).toBe(10.01)
    expect(round2(10)).toBe(10)
  })
})

describe('formatMoney', () => {
  it('formats with 2 decimals in the store currency', () => {
    expect(formatMoney(25, 'USD')).toContain('25.00')
    expect(formatMoney(71.666666, 'TRY')).toContain('71.67')
  })
})
