import { describe, expect, it } from 'vitest'
import { unitLong, unitShort } from './units'

const en = (key: string): string =>
  (
    {
      'units.pcs': 'pcs',
      'units.pcsLong': 'Pieces',
      'units.boxLong': 'Boxes'
    } as Record<string, string>
  )[key] ?? key

describe('unit labels', () => {
  it('returns translated short and long labels', () => {
    expect(unitShort('pcs', en)).toBe('pcs')
    expect(unitLong('pcs', en)).toBe('Pieces')
  })

  it('falls back to the code when untranslated', () => {
    expect(unitShort('kg', en)).toBe('kg')
    expect(unitLong('m', en)).toBe('m')
  })
})
