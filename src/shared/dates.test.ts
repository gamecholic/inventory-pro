import { describe, expect, it } from 'vitest'
import { dayBounds, formatDateTime, formatISO, fromISO, presetRange, toISO, type StoreDateFormat } from './dates'

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

  it('appends local 24h time for date-time display', () => {
    const out = formatDateTime('2026-09-05T10:30:00.000Z', 'YYYY-MM-DD')
    expect(out).toMatch(/^2026-09-05 \d{2}:\d{2}$/)
  })

  it('converts draft dates to ISO day bounds', () => {
    const bounds = dayBounds({ from: new Date(2026, 8, 5, 15, 30), to: new Date(2026, 8, 6, 9, 15) })
    const from = new Date(bounds.from)
    const to = new Date(bounds.to)
    expect([from.getHours(), from.getMinutes(), from.getSeconds()]).toEqual([0, 0, 0])
    expect([to.getHours(), to.getMinutes()]).toEqual([23, 59])
    expect(from.getTime()).toBeLessThan(to.getTime())
  })
})

describe('presetRange', () => {
  // Saturday 2026-09-05 15:00 local.
  const now = new Date(2026, 8, 5, 15, 0, 0)

  it('bounds today to start of day', () => {
    const r = presetRange('today', now)
    expect(r.from).toEqual(new Date(2026, 8, 5, 0, 0, 0))
    expect(r.to).toBe(now)
  })

  it('starts the week on Monday', () => {
    expect(presetRange('week', now).from).toEqual(new Date(2026, 7, 31, 0, 0, 0))
  })

  it('spans calendar month and year', () => {
    expect(presetRange('month', now).from).toEqual(new Date(2026, 8, 1, 0, 0, 0))
    expect(presetRange('year', now).from).toEqual(new Date(2026, 0, 1, 0, 0, 0))
  })

  it('spans trailing 30 days, 1 year and 5 years', () => {
    expect(presetRange('lastMonth', now).from).toEqual(new Date(2026, 7, 6, 0, 0, 0))
    expect(presetRange('lastYear', now).from).toEqual(new Date(2025, 8, 5, 0, 0, 0))
    expect(presetRange('last5Years', now).from).toEqual(new Date(2021, 8, 5, 0, 0, 0))
  })
})
