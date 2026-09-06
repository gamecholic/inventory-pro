import { describe, expect, it } from 'vitest'
import { chartMoneyFormatter, formatMoney, round2 } from './money'

describe('round2', () => {
  it('rounds repeating decimals to cents', () => {
    expect(round2(71.66666666666667)).toBe(71.67)
    expect(round2(10.005)).toBe(10.01)
    expect(round2(10)).toBe(10)
  })
})

describe('formatMoney', () => {
  it('uses the pinned symbol for every store currency', () => {
    expect(formatMoney(25, 'USD')).toBe('$25.00')
    expect(formatMoney(25, 'EUR')).toBe('€25.00')
    expect(formatMoney(25, 'GBP')).toBe('£25.00')
    expect(formatMoney(71.666666, 'TRY')).toBe('₺71.67')
  })

  it('builds chart tooltip formatters', () => {
    expect(chartMoneyFormatter('USD')(42.5)).toBe('$42.50')
  })
})
