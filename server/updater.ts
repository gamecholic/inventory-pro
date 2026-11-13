import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, mkdirSync, createWriteStream, writeFileSync, appendFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { app, handlers } from './electron'

const UPDATE_REPO = 'gamecholic/inventory-pro'

// Override for local testing: point at a mock server (see
// scripts/mock-updater-server.mjs) instead of GitHub, e.g.
// INVENTORY_UPDATE_API_URL=http://127.0.0.1:8899/releases/latest
function updateApiUrl(): string {
  return process.env.INVENTORY_UPDATE_API_URL ?? `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`
}

let updateVersion: string | null = null
let updateAssetUrl: string | null = null
let downloadPath: string | null = null
let downloadPercent = 0
let downloaded = false

// The port the renderer is served on. The relaunch must come back on the
// same port: the browser tab is already pointed at it and reloads itself
// when the new server answers.
let serverPort = 0

/** Called by boot.ts once the server knows its port. */
export function setUpdaterPort(port: number): void {
  serverPort = port
}

function isNewer(candidate: string, current: string): boolean {
  const a = candidate.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const b = current.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/**
 * Where the silent installer puts the new exe. Running from `dist\app`
 * is NOT the install location, so `dirname(execPath)` can be the old
 * copy — launching that makes the version never change (the bug seen
 * when testing from dist). Prefer Inno's recorded InstallLocation,
 * then the default per-user install folder.
 */
function installedExePath(): string {
  const regPath = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe')
  try {
    const result = spawnSync(regPath, ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{7E2C4B10-9A6D-4F3E-8B21-5C7D9E0A1F42}_is1', '/v', 'InstallLocation'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      // No console window: the app is a GUI-subsystem process, but reg.exe
      // would otherwise be started in a fresh visible console.
      windowsHide: true
    })
    if (result.status === 0) {
      const line = String(result.stdout ?? '').split(/\r?\n/).find((l) => l.includes('InstallLocation'))
      const parts = line?.trim().split(/\s+/) ?? []
      const idx = parts.indexOf('REG_SZ')
      if (idx !== -1 && parts[idx + 1]) {
        const dir = parts.slice(idx + 1).join(' ').replace(/^"|"$/g, '')
        if (dir) return join(dir, 'Inventory Pro.exe')
      }
    }
  } catch { /* fall through */ }
  const local = process.env.LOCALAPPDATA
  if (local) return join(local, 'Programs', 'Inventory Pro', 'Inventory Pro.exe')
  return join(dirname(process.execPath), 'Inventory Pro.exe')
}

export function registerUpdaterHandlers(shutdown: (delayMs?: number) => void): void {
  handlers.set('updater:check', async () => {
    try {
      const res = await fetch(updateApiUrl(), {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'inventory-pro' }
      })
      if (!res.ok) return { status: 'error', message: `GitHub returned ${res.status}` }
      const data = (await res.json()) as { tag_name?: string; assets?: Array<{ name: string; browser_download_url: string }> }
      const version = (data.tag_name ?? '').replace(/^v/, '')
      if (!version || !isNewer(version, app.getVersion())) {
        updateVersion = null
        return { status: 'up-to-date' }
      }
      const asset = data.assets?.find((a) => /setup/i.test(a.name) && a.name.endsWith('.exe'))
      if (!asset) return { status: 'error', message: 'No installer asset found in the latest release' }
      // Keep an already staged installer for the same version: a second
      // check must not throw away the download (the About tab and the
      // update card both re-check after downloading).
      const alreadyDownloaded = updateVersion === version && downloaded
      updateVersion = version
      updateAssetUrl = asset.browser_download_url
      if (!alreadyDownloaded) {
        downloaded = false
        downloadPath = null
        downloadPercent = 0
      }
      return alreadyDownloaded
        ? { status: 'downloaded', version }
        : { status: 'available', version }
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  })

  handlers.set('updater:download', async () => {
    if (!updateVersion || !updateAssetUrl) return { status: 'up-to-date' }
    if (downloaded) return { status: 'downloaded', version: updateVersion }
    try {
      const res = await fetch(updateAssetUrl, { headers: { 'User-Agent': 'inventory-pro' } })
      if (!res.ok || !res.body) return { status: 'error', message: `Download failed: ${res.status}` }
      const dir = join(tmpdir(), 'inventory-pro-update')
      mkdirSync(dir, { recursive: true })
      const filePath = join(dir, `Inventory-Pro-Setup-${updateVersion}.exe`)
      const total = Number(res.headers.get('content-length') ?? 0)
      const reader = res.body.getReader()
      const writer = createWriteStream(filePath)
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        writer.write(value)
        received += value.byteLength
        if (total > 0) downloadPercent = Math.round((received / total) * 100)
      }
      await new Promise<void>((resolve, reject) => writer.end((err?: Error | null) => (err ? reject(err) : resolve())))
      downloadPath = filePath
      downloaded = true
      downloadPercent = 100
      return { status: 'downloaded', version: updateVersion }
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  })

  handlers.set('updater:progress', () => ({ percent: downloadPercent }))

  handlers.set('updater:install', () => {
    if (!downloaded || !downloadPath) return false
    const logFile = join(process.env.APPDATA ?? '.', 'Inventory Pro', 'launcher.log')
    const stamp = (level: string, msg: string): void => {
      try { appendFileSync(logFile, `${new Date().toISOString()} ${level} ${msg}\n`) } catch { /* ignore */ }
    }
    try {
      // Silent install replaces the exe, then the freshly installed copy is
      // launched by a detached .bat wrapper (which outlives us). The installer
      // does NOT auto-launch (/VERYSILENT skips [Run] postinstall), so
      // without the wrapper the app would stop and never come back. Use a
      // .bat file (not an inline `cmd /c "... && start ..."` string): Node's
      // quoting of cmd /c made && inside the quoted string a literal, so the
      // installer never ran at all in 1.3.7.
      const dir = join(tmpdir(), 'inventory-pro-update')
      mkdirSync(dir, { recursive: true })
      const batPath = join(dir, 'launch-update.bat')
      const newExe = installedExePath()
      const q = (s: string): string => `"${s.replace(/"/g, '""')}"`
      const bat = `@echo off\r\n` +
        // Time for the graceful shutdown (DB WAL checkpoint) to finish before
        // the installer is allowed to force-close the exe.
        `ping -n 5 127.0.0.1 >nul\r\n` +
        `${q(downloadPath)} /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /FORCECLOSEAPPLICATIONS\r\n` +
        `set "INVENTORY_VERSION="\r\n` +
        // Relaunch contract: the browser tab that asked for the update stays
        // open and reloads itself when the new server answers, so the new
        // instance must not open a second tab (the old one would be left
        // frozen on a dead server). INVENTORY_RELAUNCH_PORT pins the port
        // the tab is already using.
        `set "INVENTORY_RELAUNCH=1"\r\n` +
        `set "INVENTORY_RELAUNCH_PORT=${serverPort}"\r\n` +
        `start "" ${q(newExe)}\r\n`
      writeFileSync(batPath, bat, 'utf-8')
      stamp('INFO', `update install via bat=${batPath} installer=${downloadPath}`)
      const cmdPath = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe')
      const child = spawn(cmdPath, ['/c', batPath], {
        // Do NOT pass detached here: on Windows `detached: true` maps to
        // DETACHED_PROCESS, which makes cmd.exe allocate a fresh visible
        // console window and silently ignores windowsHide. A hidden console
        // still outlives this process (Windows does not kill children when
        // the parent exits).
        stdio: 'ignore',
        windowsHide: true,
        cwd: dirname(process.execPath)
      })
      child.on('error', (err) => stamp('ERR', `update spawn failed: ${err.message}`))
      child.unref()
      // Let the HTTP response flush, then shut down gracefully so the DB
      // checkpoint runs before the installer replaces the exe.
      shutdown(400)
      return true
    } catch (error) {
      stamp('ERR', `update install failed: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  })
}