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
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { basename, dirname, join } from 'node:path'
import { startServer, notifyScheduledBackupFailed, setShutdownHandler } from './index'
import { setUpdaterPort } from './updater'
import { getSettings } from '../src/main/db/settingsStore'
import { closeDb } from '../src/main/db/client'
import { syncAutostart } from '../src/main/autostart'
import { setScheduledBackupFailureNotifier, startScheduledBackups, stopScheduledBackups } from '../src/main/scheduledBackup'

const APP_NAME = 'Inventory Pro'
// PORT is a development knob; the installed app just tries the default range.
const FIRST_PORT = Number(process.env.PORT ?? 5178)
const LAST_PORT = FIRST_PORT + 10
const VITE_PORT = Number(process.env.VITE_PORT ?? 5173)
let HOST = process.env.HOST ?? '127.0.0.1'

// Relaunch after an update (set by the installer's .bat wrapper): the
// browser tab that requested the update is still open and reloads itself
// once this instance answers. So we come back on the very same port and
// must NOT open a second tab — that would leave the old one frozen on a
// dead server.
const RELAUNCH = process.env.INVENTORY_RELAUNCH === '1'
const RELAUNCH_PORT = Number(process.env.INVENTORY_RELAUNCH_PORT ?? 0)

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pickPort(): Promise<{ port: number; alreadyRunning: boolean }> {
  // A relaunch must come back on the port the browser tab is already
  // pointed at, otherwise the tab never finds the server again. Wait for
  // the old instance to release that exact port instead of falling back
  // to another one.
  if (RELAUNCH && RELAUNCH_PORT > 0) {
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      if (await healthy(RELAUNCH_PORT)) {
        // The old instance is still up — it is about to exit.
        await sleep(300)
        continue
      }
      if (await portFree(RELAUNCH_PORT)) return { port: RELAUNCH_PORT, alreadyRunning: false }
      await sleep(300)
    }
    log(`relaunch: port ${RELAUNCH_PORT} never freed up, falling back`)
  }
  for (let port = FIRST_PORT; port <= LAST_PORT; port++) {
    if (await healthy(port)) return { port, alreadyRunning: true }
    if (await portFree(port)) return { port, alreadyRunning: false }
  }
  throw new Error(`No free port between ${FIRST_PORT} and ${LAST_PORT}`)
}

// --- CLI: --stop / --restart --------------------------------------------------
// Outside-the-app control (shortcut with args, command line):
//   Inventory Pro.exe              start, or open a tab if already running
//   Inventory Pro.exe --restart    stop the running instance, then start fresh
//   Inventory Pro.exe --stop       stop the running instance and exit

interface CliMode {
  restart: boolean
  stop: boolean
}

function parseCliMode(): CliMode {
  // Whole argv is safe to scan: the exe/script paths never equal these flags.
  const args = process.argv
  return { restart: args.includes('--restart'), stop: args.includes('--stop') }
}

interface HealthResult {
  port: number
  pid: number
}

async function getHealth(port: number): Promise<HealthResult | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) })
    if (!response.ok) return null
    const body = (await response.json()) as { ok?: boolean; pid?: number }
    if (body.ok !== true || typeof body.pid !== 'number') return null
    return { port, pid: body.pid }
  } catch {
    return null
  }
}

async function findRunningInstance(): Promise<HealthResult | null> {
  for (let port = FIRST_PORT; port <= LAST_PORT; port++) {
    const hit = await getHealth(port)
    if (hit) return hit
  }
  return null
}

async function waitUntilStopped(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await healthy(port))) return true
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return !(await healthy(port))
}

/** Graceful stop first (DB checkpoint via app:stop), force-kill as fallback. */
async function ensureStopped(instance: HealthResult): Promise<void> {
  log(`stopping existing instance on ${instance.port} (pid ${instance.pid})`)
  try {
    await fetch(`http://127.0.0.1:${instance.port}/api/app:stop`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: {} }),
      signal: AbortSignal.timeout(3000)
    })
  } catch {
    // Graceful endpoint may be missing on an old build — fall through to kill.
  }
  if (await waitUntilStopped(instance.port, 4000)) return

  const taskkill = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe')
  log(`graceful stop timed out, force-killing pid ${instance.pid}`)
  try {
    spawnSync(taskkill, ['/PID', String(instance.pid), '/F'], { stdio: 'ignore' })
  } catch (error) {
    log(`taskkill failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!(await waitUntilStopped(instance.port, 4000))) {
    throw new Error(`Could not stop the running instance on port ${instance.port}`)
  }
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
  // After an update the browser tab that requested it is still open and
  // reloads itself when the new server answers (see the relaunch contract
  // in server/updater.ts). Opening a second tab would leave the old one
  // frozen on a dead server.
  if (RELAUNCH) {
    log('window: relaunch — the existing tab reloads itself')
    return
  }
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
// Always overwrite when compiled: an updated exe may inherit
// INVENTORY_VERSION from the old process via the updater wrapper, which
// would make it keep reporting the old version forever.
if (isCompiled() && typeof INVENTORY_VERSION === 'string') {
  process.env.INVENTORY_VERSION = INVENTORY_VERSION
} else {
  process.env.INVENTORY_VERSION ??= readPackageVersion()
}

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

  // Outside-the-app modes: --stop exits after stopping a running instance,
  // --restart stops it and then falls through to a fresh start below.
  // No args keeps the normal behaviour (start, or open a tab if running).
  const cli = parseCliMode()
  if (cli.restart || cli.stop) {
    const running = await findRunningInstance()
    if (!running) {
      log(`${cli.stop && !cli.restart ? '--stop' : '--restart'}: no running instance`)
      if (cli.stop && !cli.restart) return
    } else {
      await ensureStopped(running)
      log(`${cli.stop && !cli.restart ? '--stop' : '--restart'}: stopped`)
      if (cli.stop && !cli.restart) return
    }
  }

  resolveMigrations()

  if (!process.env.HOST) {
    try {
      HOST = getSettings().general.networkAccess ? '0.0.0.0' : '127.0.0.1'
    } catch {
      HOST = '127.0.0.1'
    }
  }

  // Start-with-Windows: reconcile the Run entry with the saved setting so a
  // moved/updated exe keeps autostart working. Never blocks launch.
  try {
    syncAutostart(getSettings().general.autoStartOnLogin)
  } catch (error) {
    log(`autostart sync failed: ${error instanceof Error ? error.message : String(error)}`)
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
  // The updater's relaunch wrapper needs the port: the browser tab reloads
  // itself against this exact address once the new instance answers.
  setUpdaterPort(server.port)
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
    try {
      closeDb()
    } catch {
      // already closed
    }
    process.exit(0)
  }
  setShutdownHandler(shutdown)
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => fatal(error instanceof Error ? error.message : String(error)))
