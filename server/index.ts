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
import { join, normalize } from 'node:path'
import { ZodError } from 'zod'
import { app, handlers } from './electron'
import { showNativeDialog } from './dialogs'
import { getDb } from '../src/main/db/client'
import { backupDir, fromBackupJson, readTextFile, toBackupJson, writeTextFile } from '../src/main/db/backup'
import { readExcelBackup, writeExcelBackup } from '../src/main/db/excel'
import { readLegacyExcelBackup } from '../src/main/db/legacyExcel'
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

function fail(status: number, message: string): Response {
  return new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

async function handleApi(request: Request, pathname: string): Promise<Response> {
  if (pathname === '/api/health') {
    return Response.json({ ok: true, version: app.getVersion(), pid: process.pid })
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

async function serveStatic(webRoot: string, pathname: string): Promise<Response> {
  const index = Bun.file(join(webRoot, 'index.html'))
  if (!(await index.exists())) {
    return fail(503, `Renderer build not found at ${webRoot}.\nRun: npm run build:web`)
  }

  const relative = normalize(pathname === '/' ? 'index.html' : pathname.slice(1))
  if (relative.startsWith('..')) return fail(403, 'Forbidden')

  const file = Bun.file(join(webRoot, relative))
  if (await file.exists()) {
    const headers: Record<string, string> = {}
    // HashRouter means every route is "/", so only the shell must stay fresh.
    if (relative.endsWith('.html')) headers['cache-control'] = 'no-store'
    return new Response(file, { headers })
  }

  // Unknown path without an extension: hand back the SPA shell.
  if (!relative.includes('.')) return new Response(index, { headers: { 'cache-control': 'no-store' } })
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
      if (url.pathname.startsWith('/api/')) return handleApi(request, url.pathname)
      return serveStatic(options.webRoot, url.pathname)
    }
  })

  return {
    port: server.port ?? options.port,
    stop: () => server.stop()
  }
}
