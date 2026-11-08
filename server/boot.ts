/**
 * Application entry point — the "double-click" experience.
 *
 * One windowless exe that:
 *   1. reuses a running instance (or starts one),
 *   2. serves the app on 127.0.0.1,
 *   3. opens it in the browser as a new tab,
 *   4. stays resident (owns the SQLite file, backups, update check).
 *
 * No environment variables are needed by the end user; everything is resolved
 * from the install folder and %APPDATA%. The env overrides below exist for
 * development and for the installer's update step.
 *
 * Dev (`npm run bun:start`, not compiled): Bun serves /api only and a Vite
 * dev server is spawned beside it on 127.0.0.1:5173 and serves the UI with
 * HMR, proxying /api to Bun. Set HMR=0 to disable and serve out/web statically.
 */
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { basename, dirname, join } from 'node:path'
import { startServer, notifyScheduledBackupFailed } from './index'
import { getSettings } from '../src/main/db/settingsStore'
import { setScheduledBackupFailureNotifier, startScheduledBackups, stopScheduledBackups } from '../src/main/scheduledBackup'

const APP_NAME = 'Inventory Pro'
// PORT is a development knob; the installed app just tries the default range.
const FIRST_PORT = Number(process.env.PORT ?? 5178)
const LAST_PORT = FIRST_PORT + 10
const VITE_PORT = Number(process.env.VITE_PORT ?? 5173)
let HOST = process.env.HOST ?? '127.0.0.1'

// --- HMR (dev only) -------------------------------------------------------

/**
 * True when running from source (`bun run server/boot.ts`) so Vite can serve
 * the UI live. The compiled exe never spawns Vite.
 */
function isHmr(): boolean {
  return !isCompiled() && process.env.HMR !== '0'
}

let viteChild: ReturnType<typeof spawn> | null = null

function startViteDev(bunPort: number): void {
  const viteBin = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(viteBin)) {
    log('hmr: vite binary not found, serving static build only')
    return
  }
  viteChild = spawn('node', [viteBin, '--config', 'vite.renderer.config.ts', '--port', String(VITE_PORT), '--host', '127.0.0.1', '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, PORT: String(bunPort) }
  })
  viteChild.on('error', (err) => log(`hmr: vite failed to start (${err.message})`))
  log(`hmr: vite http://127.0.0.1:${VITE_PORT} (api -> bun :${bunPort})`)
}

async function viteRunning(): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${VITE_PORT}/`, { signal: AbortSignal.timeout(800) })
    return r.ok
  } catch {
    return false
  }
}

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
    spawn(browser, ['--new-tab', url], { detached: true, stdio: 'ignore' }).unref()
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
  // In HMR dev mode Vite serves the UI from src/renderer, so a missing
  // out/web/index.html (fresh clone) must not be fatal. The compiled exe
  // always requires the built web root.
  if (!existsSync(join(webRoot, 'index.html')) && !isHmr()) {
    fatal(`The application files are incomplete.\n\nMissing: ${join(webRoot, 'index.html')}\n\nReinstall Inventory Pro.`)
  }

  const { port, alreadyRunning } = await pickPort()
  if (alreadyRunning) {
    log(`already running on ${port}`)
    // Re-opening a dev session: prefer the HMR Vite tab when Vite is up.
    if (isHmr() && (await viteRunning())) {
      openWindow(VITE_PORT)
    } else {
      openWindow(port)
    }
    return
  }

  const server = startServer({ port, webRoot, host: HOST })
  log(`api on http://${HOST === '0.0.0.0' ? '0.0.0.0 (LAN)' : HOST}:${server.port}`)
  log(`data: ${dataDir()}`)

  // Hourly scheduled backup (§1.8): on the hour, one file per day (latest
  // hour). Success silent (time recorded for Settings); failure pushes a
  // toast over SSE. No backup at launch — first run is the next hour.
  setScheduledBackupFailureNotifier((message) => {
    log(`scheduled-backup failed: ${message}`)
    notifyScheduledBackupFailed(message)
  })
  startScheduledBackups()

  if (isHmr() && !isCompiled()) {
    startViteDev(server.port)
    openWindow(VITE_PORT)
  } else {
    openWindow(server.port)
  }

  const shutdown = (): void => {
    stopScheduledBackups()
    if (viteChild) {
      try {
        viteChild.kill()
      } catch {
        // already stopped
      }
    }
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
