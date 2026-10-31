import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, createWriteStream } from 'node:fs'
import { spawn } from 'node:child_process'
import { app, handlers } from './electron'

const UPDATE_REPO = 'gamecholic/inventory-pro'

let updateVersion: string | null = null
let updateAssetUrl: string | null = null
let downloadPath: string | null = null
let downloadPercent = 0
let downloaded = false

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

export function registerUpdaterHandlers(): void {
  handlers.set('updater:check', async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
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
      updateVersion = version
      updateAssetUrl = asset.browser_download_url
      downloaded = false
      downloadPath = null
      downloadPercent = 0
      return { status: 'available', version }
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
    try {
      const child = spawn(downloadPath, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/FORCECLOSEAPPLICATIONS'], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
      setTimeout(() => process.exit(0), 500)
      return true
    } catch {
      return false
    }
  })
}