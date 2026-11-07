import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { msUntilNextHour } from './scheduledBackup'
import { pruneSameDayScheduledFiles, scheduledBackupFileName, scheduledDayPrefix } from './db/backup'

const HOUR = 60 * 60 * 1000

describe('scheduledBackup timing', () => {
  it('waits a full hour when starting exactly on the hour (no backup at launch)', () => {
    const onHour = new Date(2026, 10, 7, 14, 0, 0, 0).getTime()
    expect(msUntilNextHour(onHour)).toBe(HOUR)
  })

  it('waits until the next hour from mid-hour', () => {
    const midHour = new Date(2026, 10, 7, 14, 30, 0, 0).getTime()
    expect(msUntilNextHour(midHour)).toBe(30 * 60 * 1000)
  })

  it('fires almost immediately a second before the hour', () => {
    const beforeHour = new Date(2026, 10, 7, 14, 59, 59, 100).getTime()
    expect(msUntilNextHour(beforeHour)).toBe(900)
  })
})

describe('scheduled filename', () => {
  it('includes local date + HHMM', () => {
    expect(scheduledBackupFileName(new Date(2026, 10, 7, 14, 0))).toBe('inventory-2026-11-07-1400.xlsx')
    expect(scheduledBackupFileName(new Date(2026, 0, 5, 9, 5))).toBe('inventory-2026-01-05-0905.xlsx')
  })

  it('shares the day prefix across hours', () => {
    expect(scheduledDayPrefix(new Date(2026, 10, 7, 1, 0))).toBe(scheduledDayPrefix(new Date(2026, 10, 7, 23, 0)))
  })
})

describe('pruneSameDayScheduledFiles', () => {
  it('keeps only the latest hour of the day and leaves other days/manual alone', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sched-test-'))
    try {
      const now = new Date(2026, 10, 7, 15, 0)
      const keep = join(dir, scheduledBackupFileName(now))
      for (const name of [
        'inventory-2026-11-07-1400.xlsx', // earlier hour today -> deleted
        scheduledBackupFileName(now), // kept
        'inventory-2026-11-07.xlsx', // legacy daily -> deleted
        'inventory-auto-2026-11-07-1400.xlsx', // legacy Bun auto -> deleted
        'inventory-2026-11-06-2300.xlsx', // yesterday -> kept
        'inventory-20261107-140000.xlsx' // manual export style -> kept
      ]) {
        writeFileSync(join(dir, name), 'x')
      }
      pruneSameDayScheduledFiles(now, keep, dir)
      expect(readdirSync(dir).sort()).toEqual([
        'inventory-2026-11-06-2300.xlsx',
        scheduledBackupFileName(now),
        'inventory-20261107-140000.xlsx'
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
