import { describe, expect, it } from 'vitest'
import { defaultSettings, generalSettings, settingsValues, withDefaults } from './settings'

describe('settings schemas', () => {
  it('accepts the defaults', () => {
    expect(settingsValues.safeParse(defaultSettings).success).toBe(true)
  })

  it('rejects unknown currency and negative fee', () => {
    expect(generalSettings.safeParse({ ...defaultSettings.general, currency: 'JPY' }).success).toBe(false)
    expect(generalSettings.safeParse({ ...defaultSettings.general, cardFeePercent: -1 }).success).toBe(false)
  })

  it('rejects invalid business email but allows empty', () => {
    expect(
      settingsValues.safeParse({
        ...defaultSettings,
        business: { ...defaultSettings.business, email: 'not-an-email' }
      }).success
    ).toBe(false)
    expect(
      settingsValues.safeParse({
        ...defaultSettings,
        business: { ...defaultSettings.business, email: '' }
      }).success
    ).toBe(true)
  })

  it('fills missing sections/keys from defaults (forward-compatible)', () => {
    expect(withDefaults({})).toEqual(defaultSettings)
    expect(withDefaults({ general: { language: 'tr' } }).general.language).toBe('tr')
    expect(withDefaults({ general: { language: 'tr' } }).general.currency).toBe('USD')
    expect(withDefaults(null)).toEqual(defaultSettings)
  })
})
