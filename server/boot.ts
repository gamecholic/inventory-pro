/**
 * Application entry point — the "double-click" experience.
 *
 * One windowless exe that:
 *   1. reuses a running instance (or starts one),
 *   2. serves the app on 127.0.0.1,
 *   3. opens it in a chromeless Chrome/Edge window,
 *   4. stays resident (owns the SQLite file, backups, update check).
 *
 * No environment variables are needed by the end user; everything is resolved
 * from the install folder and %APPDATA%. The env overrides below exist for
 * development and for the installer's update step.
 */
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { basename, dirname, join } from 'node:path'
import { startServer } from './index'
import { getSettings } from '../src/main/db/settingsStore'
import { backupDir } from '../src/main/db/backup'
import { writeExcelBackup } from '../src/main/db/excel'

const APP_NAME = 'Inventory Pro'
// PORT is a development knob; the installed app just tries the default range.
const FIRST_PORT = Number(process.env.PORT ?? 5178)
const LAST_PORT = FIRST_PORT + 10
let HOST = process.env.HOST ?? '127.0.0.1'

// --- Paths ------------------------------------------------------------------

function isCompiled(): boolean {
  return basename(process.execPath).toLowerCase() !== 'bun.exe'
}

/** Folder holding the exe (compiled) or the repo root (dev). */
function appDir(): string {
  return isCompiled() ? dirname(process.execPath) : process.cwd()
}

function dataDir(): string {
  return process.env.INVENTORY_DATA_DIR ?? join(process.env.APPDATA ?? '.', APP_NAME)
}

function resolveWebRoot(): string {
  if (process.env.WEB_ROOT) return process.env.WEB_ROOT
  const besideExe = join(appDir(), 'web')
  if (existsSync(join(besideExe, 'index.html'))) return besideExe
  return join(process.cwd(), 'out/web')
}

function resolveMigrations(): void {
  if (process.env.INVENTORY_DRIZZLE_DIR) return
  const besideExe = join(appDir(), 'drizzle')
  if (existsSync(besideExe)) process.env.INVENTORY_DRIZZLE_DIR = besideExe
}

function log(line: string): void {
  const text = `[${new Date().toISOString()}] ${line}\n`
  try {
    const dir = dataDir()
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'launcher.log'), text)
  } catch {
    // logging must never be the reason the app fails to start
  }
  console.log(text.trimEnd())
}

/** Hidden-console build: an error would otherwise be invisible. */
function fatal(message: string): never {
  log(`FATAL ${message}`)
  const safe = message.replace(/'/g, "''").replace(/\r?\n/g, ' ')
  const script =
    `Add-Type -AssemblyName System.Windows.Forms; ` +
    `[System.Windows.Forms.MessageBox]::Show('${safe}','${APP_NAME}','OK','Error') | Out-Null`
  try {
    spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], {
      detached: true,
      stdio: 'ignore'
    }).unref()
  } catch {
    // nothing else we can do
  }
  process.exit(1)
}

// --- Single instance --------------------------------------------------------

async function healthy(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) })
    if (!response.ok) return false
    const body = (await response.json()) as { ok?: boolean }
    return body.ok === true
  } catch {
    return false
  }
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, HOST)
  })
}

async function pickPort(): Promise<{ port: number; alreadyRunning: boolean }> {
  for (let port = FIRST_PORT; port <= LAST_PORT; port++) {
    if (await healthy(port)) return { port, alreadyRunning: true }
    if (await portFree(port)) return { port, alreadyRunning: false }
  }
  throw new Error(`No free port between ${FIRST_PORT} and ${LAST_PORT}`)
}

// --- Window -----------------------------------------------------------------

function findBrowser(): string | null {
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
  const browsers = ['Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe']
  for (const browser of browsers) {
    for (const root of roots) {
      if (!root) continue
      const candidate = join(root, browser)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

function openWindow(port: number): void {
  const url = `http://127.0.0.1:${port}`
  const browser = findBrowser()
  if (browser) {
    spawn(browser, [`--app=${url}`, '--window-size=1280,800'], { detached: true, stdio: 'ignore' }).unref()
    log(`window: ${browser}`)
    return
  }
  // No Chromium-family browser: hand the URL to the default one.
  spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
  log('window: default browser (Chrome/Edge not found)')
}

// --- Version ----------------------------------------------------------------

/** Replaced at build time by scripts/build-app.ts (--define). */
declare const INVENTORY_VERSION: string | undefined

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(appDir(), 'package.json'), 'utf-8')) as { version: string }
    return pkg.version
  } catch {
    return '0.0.0'
  }
}

// The compiled exe ships without package.json, so the version is baked in.
process.env.INVENTORY_VERSION ??=
  typeof INVENTORY_VERSION === 'string' ? INVENTORY_VERSION : readPackageVersion()

// --- Main -------------------------------------------------------------------

async function main(): Promise<void> {
  // Best-effort: remove installers left in the temp folder by previous updates.
  try {
    const dir = join(tmpdir(), 'inventory-pro-update')
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (f.toLowerCase().endsWith('.exe')) {
          try { unlinkSync(join(dir, f)) } catch { /* file may be in use */ }
        }
      }
    }
  } catch { /* ignore */ }

  resolveMigrations()

  if (!process.env.HOST) {
    try {
      HOST = getSettings().general.networkAccess ? '0.0.0.0' : '127.0.0.1'
    } catch {
      HOST = '127.0.0.1'
    }
  }

  const webRoot = resolveWebRoot()
  if (!existsSync(join(webRoot, 'index.html'))) {
    fatal(`The application files are incomplete.\n\nMissing: ${join(webRoot, 'index.html')}\n\nReinstall Inventory Pro.`)
  }

  const { port, alreadyRunning } = await pickPort()
  if (alreadyRunning) {
    log(`already running on ${port}`)
    openWindow(port)
    return
  }

  const server = startServer({ port, webRoot, host: HOST })
  log(`serving on http://${HOST === '0.0.0.0' ? '0.0.0.0 (LAN)' : HOST}:${server.port}`)
  log(`data: ${dataDir()}`)

  // Hourly auto-backup (one file per day) when the toggle is on.
  const runAutoBackup = async (): Promise<void> => {
    try {
      if (!getSettings().general.autoBackup) return
      const dir = backupDir()
      const now = new Date()
      const pad = (n: number): string => String(n).padStart(2, '0')
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      const hour = `${pad(now.getHours())}${pad(now.getMinutes())}`
      const filePath = join(dir, `inventory-auto-${date}-${hour}.xlsx`)
      // Keep only one file per day: remove older backups from today first.
      try {
        const prefix = `inventory-auto-${date}-`
        for (const f of readdirSync(dir)) {
          if (f.startsWith(prefix) && f.endsWith('.xlsx') && f !== basename(filePath)) {
            try { unlinkSync(join(dir, f)) } catch { /* ignore */ }
          }
        }
      } catch { /* best effort */ }
      await writeExcelBackup(filePath)
      log(`auto-backup: ${filePath}`)
    } catch (error) {
      log(`auto-backup failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  // First run shortly after boot, then every hour.
  void runAutoBackup()
  setInterval(() => { void runAutoBackup() }, 60 * 60 * 1000)

  openWindow(server.port)

  const shutdown = (): void => {
    try {
      server.stop()
    } catch {
      // already stopped
    }
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => fatal(error instanceof Error ? error.message : String(error)))
