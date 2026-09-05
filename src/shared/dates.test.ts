import { describe, expect, it } from 'vitest'
import { formatISO, fromISO, toISO, type StoreDateFormat } from './dates'

describe('dates', () => {
  it('round-trips through ISO without loss', () => {
    const d = new Date('2026-09-05T10:30:00.000Z')
    expect(fromISO(toISO(d)).getTime()).toBe(d.getTime())
  })

  it('formats ISO into each store format', () => {
    const iso = '2026-09-05T10:30:00.000Z'
    const cases: Array<[StoreDateFormat, string]> = [
      ['MM/DD/YYYY', '09/05/2026'],
      ['DD/MM/YYYY', '05/09/2026'],
      ['YYYY-MM-DD', '2026-09-05']
    ]
    for (const [fmt, expected] of cases) {
      expect(formatISO(iso, fmt)).toBe(expected)
    }
  })
})
