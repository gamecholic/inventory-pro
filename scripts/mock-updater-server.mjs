#!/usr/bin/env node
/**
 * Local updater test server — mocks GitHub Releases for the auto-updater.
 *
 * Serves the same shape as `GET /repos/<owner>/<repo>/releases/latest`
 * plus the installer file and `checksums.txt` (sha256sum format) from your
 * local `dist/installer/`:
 *
 *   node scripts/mock-updater-server.mjs [port] [installerPath] [version]
 *
 * Defaults: port 8899, first Inventory-Pro-Setup-*.exe in dist/installer/,
 * version parsed from the filename (e.g. 1.3.9).
 *
 * THEN run the app pointing at it:
 *   INVENTORY_UPDATE_API_URL=http://127.0.0.1:8899/releases/latest "Inventory Pro.exe"
 * (PowerShell: $env:INVENTORY_UPDATE_API_URL=...; Start-Process "Inventory Pro.exe")
 * and use Settings/Update card: Download -> Restart Now. The app should
 * silently install the local installer and relaunch at the new version —
 * no GitHub Action, no new Release, no tag.
 *
 * For a fresh-version test: bump package.json, `npm run app:installer`,
 * restart the mock (it picks the newest setup exe), then run the old app.
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'

const port = Number(process.argv[2] ?? 8899)
const root = process.cwd()
const installerDir = join(root, 'dist', 'installer')

let installerPath = process.argv[3] ?? ''
if (!installerPath) {
  const candidates = existsSync(installerDir)
    ? readdirSync(installerDir).filter((f) => f.toLowerCase().endsWith('.exe'))
    : []
  // Newest first so a just-built installer wins.
  candidates.sort((a, b) => statSync(join(installerDir, b)).mtimeMs - statSync(join(installerDir, a)).mtimeMs)
  installerPath = candidates[0] ? join(installerDir, candidates[0]) : ''
}
const version = process.argv[4] ?? (basename(installerPath).match(/(\d+\.\d+\.\d+)/)?.[1] ?? '0.0.0')
// Optional delay between 256 KB chunks so the UI progress bar is visible
// (a local file downloads in well under a second).
const throttleMs = Number(process.env.MOCK_THROTTLE_MS ?? 0)

if (!installerPath || !existsSync(installerPath)) {
  console.error(`No installer found. Build one first: npm run app:installer`)
  console.error(`Looked in: ${installerDir}`)
  process.exit(1)
}

const installerName = basename(installerPath)
// Same bytes for the download and the checksum, cached per file mtime so a
// rebuild between runs is picked up without restarting the mock.
let installerCache = { mtimeMs: -1, bytes: null, sha256: '' }
function installer() {
  const { mtimeMs } = statSync(installerPath)
  if (!installerCache.bytes || installerCache.mtimeMs !== mtimeMs) {
    const bytes = readFileSync(installerPath)
    installerCache = { mtimeMs, bytes, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  return installerCache
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (url.pathname === '/releases/latest') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      tag_name: `v${version}`,
      assets: [
        { name: installerName, browser_download_url: `http://127.0.0.1:${port}/installer.exe` },
        { name: 'checksums.txt', browser_download_url: `http://127.0.0.1:${port}/checksums.txt` }
      ]
    }))
    console.log(`[mock] GET /releases/latest -> v${version}`)
    return
  }
  if (url.pathname === '/checksums.txt') {
    // sha256sum format, as .github/workflows/release.yml publishes it.
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`${installer().sha256}  ${installerName}\n`)
    console.log(`[mock] GET /checksums.txt`)
    return
  }
  if (url.pathname === '/installer.exe') {
    const data = installer().bytes
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': data.length })
    if (throttleMs > 0) {
      // Slow the stream down so the UI download progress is observable.
      const chunkSize = 256 * 1024
      let offset = 0
      const pump = () => {
        if (offset >= data.length) {
          res.end()
          console.log(`[mock] GET /installer.exe done (${(data.length / 1024 / 1024).toFixed(1)} MB, throttled)`)
          return
        }
        res.write(data.subarray(offset, offset + chunkSize))
        offset += chunkSize
        setTimeout(pump, throttleMs)
      }
      pump()
      return
    }
    res.end(data)
    console.log(`[mock] GET /installer.exe (${(data.length / 1024 / 1024).toFixed(1)} MB)`)
    return
  }
  res.writeHead(404)
  res.end('not found')
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock updater on http://127.0.0.1:${port}/releases/latest`)
  console.log(`Serving installer v${version}: ${installerPath}`)
  console.log(`Run the app with:  $env:INVENTORY_UPDATE_API_URL="http://127.0.0.1:${port}/releases/latest"`)
})
