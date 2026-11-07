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
    expect(withDefaults({}).general.backupDir).toBe('')
    expect(withDefaults({ general: { language: 'tr' } }).general.language).toBe('tr')
    expect(withDefaults({ general: { language: 'tr' } }).general.currency).toBe('USD')
    expect(withDefaults(null)).toEqual(defaultSettings)
  })

  it('migrates legacy backup flags to scheduledBackup', () => {
    expect(withDefaults({ general: { backupOnClose: true } }).general.scheduledBackup).toBe(true)
    expect(withDefaults({ general: { autoBackup: true } }).general.scheduledBackup).toBe(true)
    expect(withDefaults({ general: { autoBackup: false } }).general.scheduledBackup).toBe(false)
    // An explicit new value wins over legacy ones.
    expect(withDefaults({ general: { autoBackup: true, scheduledBackup: false } }).general.scheduledBackup).toBe(false)
    const migrated = withDefaults({ general: { backupOnClose: true } }).general
    expect('backupOnClose' in migrated).toBe(false)
    expect('autoBackup' in migrated).toBe(false)
  })

  it('defaults scheduledBackupLastAt to null and validates ISO or null', () => {
    expect(defaultSettings.general.scheduledBackupLastAt).toBeNull()
    expect(withDefaults({}).general.scheduledBackupLastAt).toBeNull()
    expect(
      generalSettings.safeParse({ ...defaultSettings.general, scheduledBackupLastAt: 'not-a-date' }).success
    ).toBe(false)
    expect(
      generalSettings.safeParse({ ...defaultSettings.general, scheduledBackupLastAt: '2026-11-07T14:00:00.000Z' }).success
    ).toBe(true)
  })
})
