#!/usr/bin/env node
/**
 * Local updater test server — mocks GitHub Releases for the auto-updater.
 *
 * Serves the same shape as `GET /repos/<owner>/<repo>/releases/latest`
 * plus the installer file itself, from your local `dist/installer/`:
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

if (!installerPath || !existsSync(installerPath)) {
  console.error(`No installer found. Build one first: npm run app:installer`)
  console.error(`Looked in: ${installerDir}`)
  process.exit(1)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (url.pathname === '/releases/latest') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      tag_name: `v${version}`,
      assets: [{ name: basename(installerPath), browser_download_url: `http://127.0.0.1:${port}/installer.exe` }]
    }))
    console.log(`[mock] GET /releases/latest -> v${version}`)
    return
  }
  if (url.pathname === '/installer.exe') {
    const data = readFileSync(installerPath)
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': data.length })
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
