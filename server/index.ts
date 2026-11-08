/**
 * Bun replacement for the Electron main process.
 *
 * The IPC handlers in src/main/ipc/* are reused as-is: they register into the
 * `ipcMain` shim and are exposed here as POST /api/<channel>. The renderer is
 * untouched apart from installing a fetch-based `window.api`.
 *
 * `startServer` has no side effects on import; server/boot.ts owns the process
 * lifecycle (single instance, port choice, opening the window).
 */
import { extname, join, normalize, dirname } from 'node:path'
import { networkInterfaces } from 'node:os'
import { existsSync, appendFileSync as appendFileSyncUtil } from 'node:fs'
import { spawn } from 'node:child_process'
import { ZodError } from 'zod'
import { app, handlers } from './electron'
import { showNativeDialog } from './dialogs'
import { getDb } from '../src/main/db/client'
import { backupDir, fromBackupJson, readTextFile, toBackupJson, writeTextFile } from '../src/main/db/backup'
import { getSettings } from '../src/main/db/settingsStore'
import { registerAnalyticsIpc } from '../src/main/ipc/analytics'
import { registerBackupIpc } from '../src/main/ipc/backup'
import { registerCatalogIpc } from '../src/main/ipc/catalog'
import { registerExpensesIpc } from '../src/main/ipc/expenses'
import { registerSalesIpc } from '../src/main/ipc/sales'
import { registerSettingsIpc } from '../src/main/ipc/settings'
import { registerUpdaterHandlers } from './updater'

// --- Ported IPC handlers -----------------------------------------------------

registerSettingsIpc()
registerBackupIpc()
registerCatalogIpc()
registerExpensesIpc()
registerAnalyticsIpc()
registerSalesIpc()
// Trivial channels that lived in main/index.ts.
handlers.set('app:ping', () => 'pong')
handlers.set('app:version', () => app.getVersion())

// Graceful stop hook: boot.ts registers its shutdown() here so an outside
// `Inventory Pro.exe --stop/--restart` can stop this instance over HTTP
// without an abrupt taskkill (which would skip the DB WAL checkpoint).
let shutdownHook: (() => void) | null = null
export function setShutdownHandler(fn: () => void): void {
  shutdownHook = fn
}

handlers.set('app:stop', () => {
  if (!shutdownHook) return { stopping: false }
  // Delay so this HTTP response flushes before the process exits.
  setTimeout(() => {
    try {
      shutdownHook?.()
    } catch {
      process.exit(0)
    }
  }, 150)
  return { stopping: true }
})

/**
 * UI-triggered restart: launch scripts/server-restart.bat (which calls the
 * exe with --restart) detached. The new instance stops this one gracefully
 * via app:stop, then starts fresh — settings like Network / DB location
 * are re-read. Falls back to spawning the exe directly if the .bat is not
 * bundled (dev without dist\app).
 */
handlers.set('app:restart', () => {
  const cmdPath = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe')
  const batCandidates = [
    join(dirname(process.execPath), 'server-restart.bat'),
    join(process.cwd(), 'scripts', 'server-restart.bat'),
    join(process.cwd(), 'server-restart.bat')
  ]
  const bat = batCandidates.find((p) => existsSync(p)) ?? null
  const logFile = join(process.env.APPDATA ?? '.', 'Inventory Pro', 'launcher.log')
  const stamp = (level: string, msg: string): void => {
    try { appendFileSyncUtil(logFile, `${new Date().toISOString()} ${level} ${msg}\n`) } catch { /* ignore */ }
  }
  if (bat) {
    stamp('INFO', `restart via bat=${bat}`)
    const child = spawn(cmdPath, ['/c', bat], { detached: true, stdio: 'ignore', cwd: dirname(bat) })
    child.on('error', (err) => stamp('ERR', `restart bat spawn failed (cmd=${cmdPath}, bat=${bat}): ${err.message}`))
    child.unref()
    return { restarting: true, script: bat }
  }
  // Fallback: spawn the exe itself with --restart (compiled only; in dev
  // process.execPath is bun.exe, so use the boot entry instead).
  const isDev = process.execPath.toLowerCase().endsWith('bun.exe')
  if (isDev) {
    stamp('INFO', 'restart via bun dev boot.ts')
    const child = spawn(process.execPath, ['run', '--tsconfig-override', './tsconfig.bun.json', 'server/boot.ts', '--restart'], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    })
    child.on('error', (err) => stamp('ERR', `restart dev spawn failed: ${err.message}`))
    child.unref()
    return { restarting: true, script: null }
  }
  stamp('INFO', `restart via exe=${process.execPath} --restart`)
  const child = spawn(process.execPath, ['--restart'], { detached: true, stdio: 'ignore', cwd: dirname(process.execPath) })
  child.on('error', (err) => stamp('ERR', `restart exe spawn failed: ${err.message}`))
  child.unref()
  return { restarting: true, script: null }
})

/**
 * Launch scripts/enable-lan.ps1 elevated (UAC) so LAN sharing works on the
 * first try. A visible PowerShell window is intentional here: the elevated
 * child must show its OK line (hidden + ignore hid UAC/success entirely).
 * Falls back to an inline New-NetFirewallRule when the .ps1 wasn't bundled.
 */
handlers.set('network:enable-firewall', async () => {
  const candidates = [
    join(dirname(process.execPath), 'enable-lan.ps1'),
    join(process.cwd(), 'scripts', 'enable-lan.ps1'),
    join(process.cwd(), 'enable-lan.ps1')
  ]
  const script = candidates.find((p) => existsSync(p)) ?? null
  // Single-quote the path for PowerShell (doubling internal apostrophes).
  const psQuote = (s: string): string => `'${s.replace(/'/g, "''")}'`
  let elevArgs: string
  let cwd: string
  if (script) {
    // ArgumentArray form avoids the -File "C:\path with spaces" double-quote trap.
    elevArgs = `'-ExecutionPolicy','Bypass','-NoProfile','-File',${psQuote(script)}`
    cwd = dirname(script)
  } else {
    elevArgs = `'-ExecutionPolicy','Bypass','-NoProfile','-Command',"Get-NetFirewallRule -DisplayName 'Inventory Pro (5178)' -ErrorAction SilentlyContinue | Remove-NetFirewallRule; New-NetFirewallRule -DisplayName 'Inventory Pro (5178)' -Direction Inbound -Protocol TCP -LocalPort 5178 -Action Allow -Profile Any -Description 'Inventory Pro LAN sharing' | Out-Null"`
    cwd = process.cwd()
  }
  // Absolute path: a windowless GUI exe may not inherit the dev shell's PATH,
  // so 'powershell.exe' can fail to resolve and silently never elevate.
  const psPath = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  // -Wait so the HTTP request stays open through the UAC prompt and script
  // run; the Settings toast then reflects the real result instead of a
  // fire-and-forget "started" that may have never elevated.
  const psCmd = `Start-Process -FilePath '${psPath.replace(/'/g, "''")}' -Verb RunAs -WorkingDirectory ${psQuote(cwd)} -ArgumentList ${elevArgs} -Wait`
  console.log(`network:enable-firewall -> ${script ?? '(inline fallback)'} :: ${psCmd}`)
  const logFile = join(process.env.APPDATA ?? '.', 'Inventory Pro', 'launcher.log')
  const stamp = (level: string, msg: string): void => {
    try { appendFileSyncUtil(logFile, `${new Date().toISOString()} ${level} ${msg}\n`) } catch { /* ignore */ }
  }
  stamp('INFO', `enable-firewall cmd=${psCmd}`)

  await new Promise<void>((resolve) => {
    const child = spawn(psPath, ['-NoProfile', '-NoLogo', '-Command', psCmd], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const timer = setTimeout(() => {
      stamp('WARN', 'enable-firewall timed out after 120s (UAC dismissed?)')
      try { child.kill() } catch { /* ignore */ }
      resolve()
    }, 120_000)
    child.stdout?.on('data', (d) => stamp('OUT', String(d).trimEnd()))
    child.stderr?.on('data', (d) => stamp('ERR', String(d).trimEnd()))
    child.on('error', (err) => {
      stamp('ERR', `spawn failed (psPath=${psPath}, script=${script}): ${err.message}`)
      clearTimeout(timer)
      resolve()
    })
    child.on('exit', (code, sig) => {
      stamp('INFO', `elevate parent exit code=${code} signal=${sig ?? ''}`)
      clearTimeout(timer)
      resolve()
    })
  })
  return { started: true, script }
})

// electron-updater is gone. Stubs keep the update card quiet until the
// installer-based updater (docs/migrate-to-bun.md §6) exists.
registerUpdaterHandlers()

// --- File handling ----------------------------------------------------------
// The server is local, so it raises real Windows dialogs and returns absolute
// paths — the same contract the Electron build had. No uploads, no browser
// file input, no dead Browse buttons.

handlers.set('backup:export-json', async () => {
  const filePath = await showNativeDialog({
    kind: 'save',
    title: 'Export JSON backup',
    path: join(backupDir(), 'inventory-backup.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!filePath) return null
  writeTextFile(filePath, toBackupJson())
  return filePath
})

handlers.set('backup:export-excel', async () => {
  const filePath = await showNativeDialog({
    kind: 'save',
    title: 'Export Excel backup',
    path: join(backupDir(), 'inventory-backup.xlsx'),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (!filePath) return null
  const { writeExcelBackup } = await import('../src/main/db/excel')
  await writeExcelBackup(filePath)
  return filePath
})

handlers.set('backup:import-json', async () => {
  const filePath = await showNativeDialog({
    kind: 'open',
    title: 'Import JSON backup',
    path: join(backupDir(), 'inventory-backup.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!filePath) return null
  return { filePath, ...fromBackupJson(readTextFile(filePath)) }
})

handlers.set('backup:import-excel', async () => {
  const filePath = await showNativeDialog({
    kind: 'open',
    title: 'Import Excel backup',
    path: join(backupDir(), 'inventory-backup.xlsx'),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (!filePath) return null
  const { readExcelBackup } = await import('../src/main/db/excel')
  return { filePath, ...(await readExcelBackup(filePath)) }
})

handlers.set('backup:import-legacy-excel', async () => {
  const filePath = await showNativeDialog({
    kind: 'open',
    title: 'Import from old app Excel',
    path: backupDir(),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (!filePath) return null
  const { readLegacyExcelBackup } = await import('../src/main/db/legacyExcel')
  return { filePath, ...(await readLegacyExcelBackup(filePath)) }
})

handlers.set('backup:select-dir', () =>
  showNativeDialog({ kind: 'folder', title: 'Choose backup folder', path: backupDir() })
)



handlers.set('db:select-dir', () =>
  showNativeDialog({ kind: 'folder', title: 'Choose database folder', path: app.getPath('userData') })
)

// --- Server -> renderer push (scheduled-backup failures) -----------------------
// Electron used a BrowserWindow push; here it's one SSE stream. The renderer
// subscribes with EventSource and shows a toast (see App.tsx). Success stays
// silent — only failures are sent.

const backupEventClients = new Set<ReadableStreamDefaultController<Uint8Array>>()
const encoder = new TextEncoder()

/** Broadcast a scheduled-backup failure to every connected tab. */
export function notifyScheduledBackupFailed(message: string): void {
  const payload = `data: ${JSON.stringify({ message })}\n\n`
  for (const controller of backupEventClients) {
    try {
      controller.enqueue(encoder.encode(payload))
    } catch {
      // client went away mid-send; its cancel handler cleans up
      backupEventClients.delete(controller)
    }
  }
}

function backupEventsResponse(): Response {
  let heartbeat: ReturnType<typeof setInterval> | null = null
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      backupEventClients.add(controller)
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          // ignore — client is gone
        }
      }, 15_000)
    },
    cancel(controller) {
      backupEventClients.delete(controller)
      if (heartbeat !== null) clearInterval(heartbeat)
    }
  })
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive'
    }
  })
}

// --- HTTP -------------------------------------------------------------------

/** First private IPv4 LAN address, preferring 192.168.* > 10.* > 172.16-31.*. */
function getLanIp(): string | null {
  const nets = networkInterfaces()
  const candidates: string[] = []
  for (const list of Object.values(nets).flat()) {
    if (!list) continue
    if (list.family === 'IPv4' && !list.internal) candidates.push(list.address)
  }
  if (candidates.length === 0) return null
  const score = (ip: string): number => {
    if (ip.startsWith('192.168.')) return 0
    if (ip.startsWith('10.')) return 1
    const second = Number(ip.split('.')[1])
    if (ip.startsWith('172.') && second >= 16 && second <= 31) return 2
    return 3
  }
  return candidates.sort((a, b) => score(a) - score(b))[0] ?? null
}

function networkInfo(port: number, host: string): Response {
  const lanIp = getLanIp()
  let networkAccess = false
  try {
    networkAccess = getSettings().general.networkAccess
  } catch {
    // DB not open yet; host binding already reflects the flag.
  }
  return Response.json({
    lanIp,
    port,
    host,
    networkAccess,
    url: lanIp ? `http://${lanIp}:${port}` : null,
    lanReachable: host === '0.0.0.0'
  })
}

function fail(status: number, message: string): Response {
  return new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

async function handleApi(
  request: Request,
  pathname: string,
  ctx?: { port: number; host: string }
): Promise<Response> {
  if (pathname === '/api/health') {
    return Response.json({ ok: true, version: app.getVersion(), pid: process.pid })
  }

  if (pathname === '/api/network-info') {
    return networkInfo(ctx?.port ?? 5178, ctx?.host ?? '127.0.0.1')
  }

  if (pathname === '/api/backup-events' && request.method === 'GET') {
    return backupEventsResponse()
  }

  if (request.method !== 'POST') return fail(405, 'Use POST')

  const channel = decodeURIComponent(pathname.slice('/api/'.length))
  const handler = handlers.get(channel)
  if (!handler) return fail(404, `Unknown channel: ${channel}`)

  let payload: unknown
  try {
    const body = (await request.json()) as { payload?: unknown }
    payload = body.payload
  } catch {
    payload = undefined
  }

  try {
    const result = await handler(undefined, payload)
    return Response.json(result ?? null)
  } catch (error) {
    if (error instanceof ZodError) return fail(400, error.issues[0]?.message ?? 'Invalid request')
    return fail(500, error instanceof Error ? error.message : String(error))
  }
}

const STATIC_CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
}

async function serveFile(
  webRoot: string,
  relative: string,
  acceptEncoding: string | null
): Promise<Response | null> {
  const candidates: Array<{ suffix: string; encoding: string }> = []
  if (acceptEncoding?.includes('br')) candidates.push({ suffix: '.br', encoding: 'br' })
  if (acceptEncoding?.includes('gzip')) candidates.push({ suffix: '.gz', encoding: 'gzip' })

  for (const { suffix, encoding } of candidates) {
    const compressed = Bun.file(join(webRoot, `${relative}${suffix}`))
    if (await compressed.exists()) {
      const headers: Record<string, string> = {
        'content-encoding': encoding,
        vary: 'Accept-Encoding'
      }
      const type = STATIC_CONTENT_TYPES[extname(relative)]
      if (type) headers['content-type'] = type
      const slashRelative = relative.replace(/\\/g, '/')
      if (relative.endsWith('.html')) {
        // HashRouter means every route is "/", so only the shell must stay fresh.
        headers['cache-control'] = 'no-store'
      } else if (slashRelative.startsWith('assets/')) {
        headers['cache-control'] = 'public, max-age=31536000, immutable'
      } else {
        headers['cache-control'] = 'public, max-age=86400'
      }
      return new Response(compressed, { headers })
    }
  }

  const file = Bun.file(join(webRoot, relative))
  if (!(await file.exists())) return null
  const headers: Record<string, string> = {}
  const slashRelative = relative.replace(/\\/g, '/')
  if (relative.endsWith('.html')) {
    headers['cache-control'] = 'no-store'
  } else if (slashRelative.startsWith('assets/')) {
    headers['cache-control'] = 'public, max-age=31536000, immutable'
  } else if (relative.includes('.')) {
    headers['cache-control'] = 'public, max-age=86400'
  }
  return new Response(file, { headers })
}

async function serveStatic(webRoot: string, pathname: string, acceptEncoding: string | null): Promise<Response> {
  const index = Bun.file(join(webRoot, 'index.html'))
  if (!(await index.exists())) {
    return fail(503, `Renderer build not found at ${webRoot}.\nRun: npm run build:web`)
  }

  const relative = normalize(pathname === '/' ? 'index.html' : pathname.slice(1))
  if (relative.startsWith('..')) return fail(403, 'Forbidden')

  const served = await serveFile(webRoot, relative, acceptEncoding)
  if (served) return served

  // Unknown path without an extension: hand back the SPA shell.
  if (!relative.includes('.')) {
    const shell =
      (await serveFile(webRoot, 'index.html', acceptEncoding)) ??
      new Response(index, { headers: { 'cache-control': 'no-store' } })
    return shell
  }
  return fail(404, 'Not found')
}

export interface ServerOptions {
  port: number
  webRoot: string
  host?: string
}

export interface RunningServer {
  port: number
  stop: () => void
}

/** Open the database, then serve the API + renderer on 127.0.0.1. */
export function startServer(options: ServerOptions): RunningServer {
  getDb()

  const host = options.host ?? '127.0.0.1'
  const server = Bun.serve({
    hostname: host,
    port: options.port,
    // SSE (/api/backup-events) stays open indefinitely. Bun's default 10s
    // idle timeout would kill it before the 15s heartbeat, so the browser
    // would reconnect every ~10s and churn Network entries. Disable it.
    idleTimeout: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname.startsWith('/api/')) {
        return handleApi(request, url.pathname, { port: server.port ?? options.port, host })
      }
      return serveStatic(options.webRoot, url.pathname, request.headers.get('accept-encoding'))
    }
  })

  return {
    port: server.port ?? options.port,
    stop: () => server.stop()
  }
}
