import { describe, expect, it } from 'vitest'
import { updaterCheck, updaterProgress, updaterStatus } from './updater'

describe('updater contract', () => {
  it('accepts the lifecycle states', () => {
    for (const status of ['up-to-date', 'available', 'downloading', 'downloaded', 'error'] as const) {
      expect(updaterStatus.parse(status)).toBe(status)
    }
    expect(() => updaterStatus.parse('installing')).toThrow()
  })

  it('parses check results and progress', () => {
    expect(updaterCheck.parse({ status: 'up-to-date' })).toMatchObject({ status: 'up-to-date' })
    expect(updaterCheck.parse({ status: 'available', version: '1.1.0' })).toMatchObject({
      status: 'available',
      version: '1.1.0'
    })
    expect(updaterProgress.parse({ percent: 42.5 })).toMatchObject({ percent: 42.5 })
    expect(() => updaterProgress.parse({ percent: 101 })).toThrow()
  })
})
