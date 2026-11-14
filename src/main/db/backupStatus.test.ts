import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifySync,
  detectProvider,
  listBackupFiles,
  pickNewestBackup,
  pickReferenceFile
} from './backupStatus'

const MINUTE = 60 * 1000

function withTempDir<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'backup-status-'))
  try {
    return run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function touch(dir: string, name: string, ageMs: number, now: number): string {
  const path = join(dir, name)
  writeFileSync(path, 'x')
  const at = (now - ageMs) / 1000
  utimesSync(path, at, at)
  return path
}

describe('detectProvider', () => {
  it('recognises the Google Drive mirror root and the stream drive', () => {
    expect(detectProvider('C:\\Users\\PC\\Google Drive\\Backups', {})).toBe('google-drive')
    expect(detectProvider('C:\\Users\\PC\\Google Drive', {})).toBe('google-drive')
    expect(detectProvider('G:\\My Drive\\Inventory', {})).toBe('google-drive')
    expect(detectProvider('G:\\My Drive', {})).toBe('google-drive')
    expect(detectProvider('G:\\Shared drives\\Shop\\Backups', {})).toBe('google-drive')
  })

  it('recognises a OneDrive folder from the environment its client sets', () => {
    const env = { OneDrive: 'C:\\Users\\PC\\OneDrive' }
    expect(detectProvider('C:\\Users\\PC\\OneDrive', env)).toBe('onedrive')
    expect(detectProvider('C:\\Users\\PC\\OneDrive\\Backups', env)).toBe('onedrive')
    expect(detectProvider('C:\\Users\\PC\\OneDrive - Shop\\Backups', { OneDriveCommercial: 'C:\\Users\\PC\\OneDrive - Shop' })).toBe(
      'onedrive'
    )
  })

  it('does not confuse a lookalike folder or a plain local folder', () => {
    expect(detectProvider('C:\\Users\\PC\\OneDriveBackups', { OneDrive: 'C:\\Users\\PC\\OneDrive' })).toBe('local')
    expect(detectProvider('C:\\Code\\inventory-pro\\backups', {})).toBe('local')
    expect(detectProvider('D:\\Sirket\\My Documents', {})).toBe('local')
  })
})

describe('classifySync', () => {
  it('treats equal badges as the state Explorer shows on a settled file', () => {
    expect(classifySync(3, 3)).toBe('synced')
  })

  it('treats a differing badge as still uploading', () => {
    expect(classifySync(0, 3)).toBe('pending')
    expect(classifySync(4, 3)).toBe('pending')
  })

  it('cannot tell without a settled reference badge', () => {
    expect(classifySync(0, 0)).toBe('unknown')
    expect(classifySync(3, -1)).toBe('unknown')
  })

  it('does not read an unreadable file as uploading', () => {
    expect(classifySync(-1, 3)).toBe('unknown')
  })
})

describe('backup file selection', () => {
  it('picks the newest scheduled-format file regardless of how it was generated', () => {
    withTempDir((dir) => {
      const now = Date.now()
      touch(dir, 'inventory-2026-11-14-1800.xlsx', MINUTE, now)
      touch(dir, 'inventory-2026-11-13-1400.xlsx', 25 * 60 * MINUTE, now)
      touch(dir, 'notes.xlsx', 2 * MINUTE, now)
      touch(dir, 'inventory-2026-11-14-1800.xlsx.tmp', 0, now)

      const files = listBackupFiles(dir)
      expect(files.map((file) => file.name).sort()).toEqual([
        'inventory-2026-11-13-1400.xlsx',
        'inventory-2026-11-14-1800.xlsx'
      ])
      expect(pickNewestBackup(files)?.name).toBe('inventory-2026-11-14-1800.xlsx')
    })
  })

  it('uses an aged file, never the newest one, as the settled reference', () => {
    withTempDir((dir) => {
      const now = Date.now()
      const newest = touch(dir, 'inventory-2026-11-14-1800.xlsx', MINUTE, now)
      touch(dir, 'inventory-2026-11-12-0900.xlsx', 2 * 24 * 60 * MINUTE, now)
      touch(dir, 'inventory-2026-11-13-0900.xlsx', 24 * 60 * MINUTE, now)

      const reference = pickReferenceFile(listBackupFiles(dir), newest, now)
      expect(reference?.name).toBe('inventory-2026-11-12-0900.xlsx')
    })
  })

  it('has no reference while the only files are fresh', () => {
    withTempDir((dir) => {
      const now = Date.now()
      const newest = touch(dir, 'inventory-2026-11-14-1800.xlsx', MINUTE, now)
      touch(dir, 'inventory-2026-11-14-0900.xlsx', 5 * MINUTE, now)

      expect(pickReferenceFile(listBackupFiles(dir), newest, now)).toBeNull()
    })
  })
})
