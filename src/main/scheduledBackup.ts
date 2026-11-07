import { renameSync, rmSync } from 'node:fs'
import { toISO } from '../shared/dates'
import { pruneSameDayScheduledFiles, scheduledBackupPath } from './db/backup'
import { writeExcelBackup } from './db/excel'
import { getSettings, updateSettings } from './db/settingsStore'

/**
 * Hourly scheduled Excel backup (features §1.8) — shared by both shells.
 *
 * Enabled/disabled from Settings > Database (general.scheduledBackup, default
 * off). When enabled, one file per (local) day — inventory-YYYY-MM-DD-HHMM.xlsx
 * in the backup folder — is written on the hour (14:00, 15:00, …). Retention
 * is one file per day: after each successful write, same-day files from
 * earlier hours (and legacy date-only / inventory-auto- files) are deleted,
 * previous days are kept. No backup runs at launch — the first one waits for
 * the next hour.
 *
 * Success is silent (but the time is recorded for Settings); failure calls the
 * notifier wired by the shell (Electron: BrowserWindow push, Bun: SSE) and is
 * always logged, never thrown. Electron-free on purpose so `server/boot.ts`
 * and the Electron shell can share this module.
 */

const HOUR_MS = 60 * 60 * 1000

let timer: ReturnType<typeof setTimeout> | null = null
let backingUp = false
let failureNotifier: ((message: string) => void) | null = null

/** Wire the shell's failure sink (toast via IPC event / SSE stream). */
export function setScheduledBackupFailureNotifier(fn: ((message: string) => void) | null): void {
  failureNotifier = fn
}

/** Milliseconds until the next on-the-hour tick. */
export function msUntilNextHour(nowMs: number = Date.now()): number {
  const delay = HOUR_MS - (nowMs % HOUR_MS)
  // Landing exactly on the hour means a full hour to the next tick, not an
  // immediate run (no backup at launch).
  return delay === HOUR_MS ? HOUR_MS : delay
}

function scheduleNext(): void {
  timer = setTimeout(
    () => {
      timer = null
      void tick()
    },
    msUntilNextHour()
  )
}

/** Run one scheduled backup if enabled. Failures notify the shell, never throw. */
export async function runScheduledBackupOnce(now: Date = new Date()): Promise<boolean> {
  const enabled = ((): boolean => {
    try {
      return getSettings().general.scheduledBackup
    } catch {
      return false
    }
  })()
  if (!enabled || backingUp) return false
  backingUp = true
  const filePath = scheduledBackupPath(now)
  const tmpPath = `${filePath}.tmp`
  try {
    await writeExcelBackup(tmpPath)
    renameSync(tmpPath, filePath)
    // Retention: drop earlier hours of today (and legacy daily/auto files).
    pruneSameDayScheduledFiles(now, filePath)
    // Record the time for the Settings "Last backup" line. Best effort.
    try {
      updateSettings('general', { scheduledBackupLastAt: toISO(now) })
    } catch (error) {
      console.error(`[scheduled-backup] could not record last-backup time: ${error instanceof Error ? error.message : String(error)}`)
    }
    return true
  } catch (error) {
    try {
      rmSync(tmpPath, { force: true })
    } catch {
      // best effort cleanup
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[scheduled-backup] failed: ${message}`)
    failureNotifier?.(message)
    return false
  } finally {
    backingUp = false
  }
}

async function tick(): Promise<void> {
  await runScheduledBackupOnce()
  scheduleNext()
}

/** Start the hourly timer. Safe to call once at app startup; reads the live setting each hour. */
export function startScheduledBackups(): void {
  if (timer !== null) return
  scheduleNext()
}

/** Stop the timer (mainly for shutdown/tests); the process just exits on quit otherwise. */
export function stopScheduledBackups(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}
