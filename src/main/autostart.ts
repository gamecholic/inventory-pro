/**
 * Start-with-Windows (per-user login autostart).
 *
 * Mechanism: the standard Windows Run key
 * `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` — the per-user
 * equivalent of Electron's `app.setLoginItemSettings({ openAtLogin: true })`,
 * which needs no administrator rights (the installer is per-user too).
 * The value `Inventory Pro` is the quoted absolute path of the running exe,
 * so updates that install to a new folder are fixed up by the launch-time
 * sync in `server/boot.ts`.
 *
 * The DB setting (`general.autoStartOnLogin`) is the source of truth: this
 * module only makes the registry match it. Dev runs (`bun.exe`) never write
 * an entry — it would point at the transient Bun binary.
 */
import { spawnSync } from 'node:child_process'
import { basename, join } from 'node:path'

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const VALUE_NAME = 'Inventory Pro'

function regExe(): string {
  return join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe')
}

function isCompiledExe(): boolean {
  return basename(process.execPath).toLowerCase() !== 'bun.exe'
}

/** Read the current Run entry (null when it does not exist or cannot be read). */
function readRunValue(): string | null {
  try {
    const result = spawnSync(regExe(), ['query', RUN_KEY, '/v', VALUE_NAME], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      // Hidden: the app has no console; without this reg.exe flashes a window.
      windowsHide: true
    })
    if (result.status !== 0) return null
    // Output line: `    Inventory Pro    REG_SZ    "C:\...\Inventory Pro.exe"`
    const line = String(result.stdout ?? '').split(/\r?\n/).find((l) => l.includes(VALUE_NAME))
    if (!line) return null
    const parts = line.trim().split(/\s+/)
    const idx = parts.indexOf('REG_SZ')
    if (idx === -1 || idx + 1 >= parts.length) return null
    return parts.slice(idx + 1).join(' ').replace(/^"|"$/g, '')
  } catch {
    return null
  }
}

/**
 * Make the Run entry match `enabled`. Idempotent; safe to call on every
 * launch. Non-fatal: registry failures are logged by the caller, never
 * thrown — the DB setting stays the source of truth and the next launch
 * reconciles.
 */
export function syncAutostart(enabled: boolean, exePath: string = process.execPath): void {
  if (process.platform !== 'win32') return
  if (!isCompiledExe()) return

  const current = readRunValue()
  if (enabled) {
    const data = `"${exePath}"`
    if (current === data) return
    const result = spawnSync(regExe(), ['add', RUN_KEY, '/v', VALUE_NAME, '/t', 'REG_SZ', '/d', data, '/f'], {
      encoding: 'utf-8',
      stdio: 'ignore',
      windowsHide: true
    })
    if (result.status !== 0) throw new Error(`reg add failed with code ${result.status}`)
  } else {
    if (current === null) return
    // Exit code 1 when the value does not exist is fine — nothing to remove.
    spawnSync(regExe(), ['delete', RUN_KEY, '/v', VALUE_NAME, '/f'], { stdio: 'ignore', windowsHide: true })
  }
}
