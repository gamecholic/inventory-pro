import { basename, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { appendFileSync, createWriteStream, mkdirSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { app, handlers } from './electron'
import { parseChecksum } from '../src/shared/updater'

const UPDATE_REPO = 'gamecholic/inventory-pro'
/**
 * Every release ships this asset (sha256sum format: `<hash>  <file>`) next to
 * the installer. The updater refuses a release without an entry for the
 * installer: an update runs code with the user's permissions, so bytes from
 * GitHub are verified before they are executed (docs/architecture.md §1).
 */
const CHECKSUMS_ASSET = 'checksums.txt'

// Override for local testing: point at a mock server (see
// scripts/mock-updater-server.mjs) instead of GitHub, e.g.
// INVENTORY_UPDATE_API_URL=http://127.0.0.1:8899/releases/latest
function updateApiUrl(): string {
  return process.env.INVENTORY_UPDATE_API_URL ?? `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`
}

let updateVersion: string | null = null
let updateAssetUrl: string | null = null
let updateAssetName: string | null = null
let checksumsUrl: string | null = null
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

/** Download the release's checksums asset and return the installer's digest. */
async function fetchExpectedChecksum(): Promise<string | null> {
  if (!checksumsUrl || !updateAssetName) return null
  const res = await fetch(checksumsUrl, { headers: { 'User-Agent': 'inventory-pro' } })
  if (!res.ok) return null
  return parseChecksum(await res.text(), updateAssetName)
}

export function registerUpdaterHandlers(shutdown: (delayMs?: number) => void): void {
  handlers.set('updater:check', async () => {
    try {
      const res = await fetch(updateApiUrl(), {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'inventory-pro' }
      })
      if (!res.ok) return { status: 'error', message: `GitHub returned ${res.status}` }
      const data = (await res.json()) as {
        tag_name?: string
        assets?: Array<{ name: string; browser_download_url: string }>
      }
      const version = (data.tag_name ?? '').replace(/^v/, '')
      if (!version || !isNewer(version, app.getVersion())) {
        updateVersion = null
        return { status: 'up-to-date' }
      }
      const asset = data.assets?.find((a) => /setup/i.test(a.name) && a.name.endsWith('.exe'))
      if (!asset) return { status: 'error', message: 'No installer asset found in the latest release' }
      const checksums = data.assets?.find((a) => a.name.toLowerCase() === CHECKSUMS_ASSET)
      if (!checksums) {
        return { status: 'error', message: `The latest release has no ${CHECKSUMS_ASSET}; refusing to update` }
      }
      // Keep an already staged installer for the same version: a second
      // check must not throw away the download (the About tab and the
      // update card both re-check after downloading).
      const alreadyDownloaded = updateVersion === version && downloaded
      updateVersion = version
      updateAssetUrl = asset.browser_download_url
      updateAssetName = asset.name
      checksumsUrl = checksums.browser_download_url
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
    const dir = join(tmpdir(), 'inventory-pro-update')
    const filePath = join(dir, `Inventory-Pro-Setup-${updateVersion}.exe`)
    try {
      // Fail closed: no digest, no download. The checksum asset is written by
      // .github/workflows/release.yml in the same run that builds the installer.
      const expected = await fetchExpectedChecksum()
      if (!expected) {
        const name = updateAssetName ?? 'the installer'
        return { status: 'error', message: `No ${CHECKSUMS_ASSET} entry for ${name}; refusing to download it` }
      }

      const res = await fetch(updateAssetUrl, { headers: { 'User-Agent': 'inventory-pro' } })
      if (!res.ok || !res.body) return { status: 'error', message: `Download failed: ${res.status}` }
      mkdirSync(dir, { recursive: true })
      const total = Number(res.headers.get('content-length') ?? 0)
      const reader = res.body.getReader()
      const writer = createWriteStream(filePath)
      const hash = createHash('sha256')
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        hash.update(value)
        writer.write(value)
        received += value.byteLength
        if (total > 0) downloadPercent = Math.round((received / total) * 100)
      }
      await new Promise<void>((resolve, reject) => writer.end((err?: Error | null) => (err ? reject(err) : resolve())))

      const actual = hash.digest('hex')
      if (actual !== expected) {
        try {
          unlinkSync(filePath)
        } catch {
          // best effort: a locked temp file is cleaned on the next launch
        }
        downloadPercent = 0
        return { status: 'error', message: `Checksum mismatch for ${basename(filePath)}; the download was discarded` }
      }

      downloadPath = filePath
      downloaded = true
      downloadPercent = 100
      return { status: 'downloaded', version: updateVersion }
    } catch (error) {
      try {
        unlinkSync(filePath)
      } catch {
        // nothing written yet, or locked
      }
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  })

  handlers.set('updater:progress', () => ({ percent: downloadPercent }))

  handlers.set('updater:install', () => {
    if (!downloaded || !downloadPath) return false
    const logFile = join(process.env.APPDATA ?? '.', 'Inventory Pro', 'launcher.log')
    const stamp = (level: string, msg: string): void => {
      try {
        appendFileSync(logFile, `${new Date().toISOString()} ${level} ${msg}\n`)
      } catch {
        /* ignore */
      }
    }
    try {
      // The installer relaunches the app itself from its [Run] entry, which is
      // gated on INVENTORY_RELAUNCH (packaging/inventory-pro.iss). That removes
      // the old .bat wrapper: no cmd.exe, no `ping` delay, no quoting layer.
      //
      // detached: Setup.exe is a GUI-subsystem program, so DETACHED_PROCESS
      // shows no console — and it guarantees the installer outlives this
      // process while it replaces the exe.
      //
      // cwd is the temp folder, never the install folder: on Windows a process
      // whose CWD is inside a folder keeps that folder from being renamed.
      const child = spawn(
        downloadPath,
        ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/FORCECLOSEAPPLICATIONS'],
        {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          cwd: dirname(downloadPath),
          env: {
            ...process.env,
            INVENTORY_RELAUNCH: '1',
            INVENTORY_RELAUNCH_PORT: String(serverPort),
            // The new exe bakes its own version; never leak the old one into it.
            INVENTORY_VERSION: ''
          }
        }
      )
      child.on('error', (err) => stamp('ERR', `update spawn failed: ${err.message}`))
      child.unref()
      stamp('INFO', `update install: installer=${downloadPath} port=${serverPort}`)
      // Let the HTTP response flush, then shut down gracefully so the DB
      // checkpoint runs before the installer closes this process.
      shutdown(400)
      return true
    } catch (error) {
      stamp('ERR', `update install failed: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  })
}
