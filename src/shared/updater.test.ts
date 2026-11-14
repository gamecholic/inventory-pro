import { describe, expect, it } from 'vitest'
import { parseChecksum, updaterCheck, updaterProgress, updaterStatus } from './updater'

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

describe('release checksums', () => {
  const installer = 'Inventory-Pro-Setup-1.4.0.exe'
  const hash = 'a'.repeat(64)

  it('finds the installer in the published listing', () => {
    expect(parseChecksum(`${hash}  ${installer}`, installer)).toBe(hash)
  })

  it('tolerates the binary marker, paths, CRLF and uppercase hashes', () => {
    const listing = [
      `${'b'.repeat(64)}  other-file.exe`,
      `${'C'.repeat(64)} *dist\\installer\\${installer}\r`
    ].join('\n')
    expect(parseChecksum(listing, installer)).toBe('c'.repeat(64))
  })

  it('returns null when the installer is not listed', () => {
    expect(parseChecksum(`${hash}  something-else.exe`, installer)).toBeNull()
    expect(parseChecksum('not a checksum file', installer)).toBeNull()
  })
})
