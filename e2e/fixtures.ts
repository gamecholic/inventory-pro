import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base, expect } from '@playwright/test'

const REPO_ROOT = process.cwd()

export { expect }

/** POST to a channel on the isolated test server (same contract as window.api). */
export async function api<T>(appUrl: string, channel: string, payload?: unknown): Promise<T> {
  const response = await fetch(`${appUrl}/api/${encodeURIComponent(channel)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload })
  })
  if (!response.ok) {
    throw new Error(`${channel} → ${response.status}: ${await response.text()}`)
  }
  return (await response.json()) as T
}

type WorkerFixtures = { appUrl: string }

/**
 * Playwright runs each spec file in its own worker process, so a worker-scoped
 * server gives each file a fresh DB and port. Spawning Bun as a child process
 * (rather than importing `startServer` into the Node-based Playwright runner)
 * is required because `server/index.ts` uses the Bun runtime.
 */
export const test = base.extend<object, WorkerFixtures>({
  appUrl: [
    // Playwright requires an object-destructuring first parameter here.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const dataDir = mkdtempSync(join(tmpdir(), 'inventory-pro-e2e-'))
      const port = 5400 + Math.floor(Math.random() * 500)
      const appUrl = `http://127.0.0.1:${port}`

      // Windows cannot spawn `bun.cmd` without a shell (Node refuses .cmd/.bat
      // direct spawns), so use the shell there and kill the process tree on
      // teardown. On POSIX the binary is spawned directly.
      const isWindows = process.platform === 'win32'
      const args = ['run', '--tsconfig-override', './tsconfig.bun.json', 'server/boot.ts']
      const options = {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          PORT: String(port),
          HOST: '127.0.0.1',
          WEB_ROOT: join(REPO_ROOT, 'out', 'web'),
          INVENTORY_DATA_DIR: dataDir,
          INVENTORY_DRIZZLE_DIR: join(REPO_ROOT, 'drizzle'),
          INVENTORY_NO_OPEN: '1',
          HMR: '0'
        },
        stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe']
      }
      // With shell:true Node must receive one command string, not an argv
      // array (otherwise it emits DEP0190). POSIX spawns the binary directly.
      const proc: ChildProcess = isWindows
        ? spawn('bun.cmd ' + args.join(' '), { ...options, shell: true })
        : spawn('bun', args, options)

      let logs = ''
      proc.stdout?.on('data', (chunk) => { logs += String(chunk) })
      proc.stderr?.on('data', (chunk) => { logs += String(chunk) })

      const deadline = Date.now() + 20_000
      let healthy = false
      while (Date.now() < deadline) {
        if (proc.exitCode !== null) break
        try {
          const response = await fetch(`${appUrl}/api/health`, {
            signal: AbortSignal.timeout(500)
          })
          if (response.ok) {
            healthy = true
            break
          }
        } catch {
          // server not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      if (!healthy) {
        proc.kill()
        throw new Error(`E2E server failed to start on port ${port}.\n${logs}`)
      }

      await use(appUrl)

      try {
        await fetch(`${appUrl}/api/app:stop`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ payload: {} }),
          signal: AbortSignal.timeout(2000)
        })
      } catch {
        // ignore — process exit below is the real cleanup
      }
      if (proc.exitCode === null) {
        if (isWindows && proc.pid) {
          try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }) } catch { /* already gone */ }
        }
        proc.kill()
      }
      try {
        rmSync(dataDir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    },
    { scope: 'worker' }
  ],

  page: async ({ page, appUrl }, use) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      // The browser logs a generic line for every non-2xx HTTP response.
      // Tests may deliberately trigger 400/500 (duplicate barcode, invalid
      // input) and the app handles them, so those are not runtime errors.
      if (/Failed to load resource/i.test(text)) return
      errors.push(`console.error: ${text}`)
    })

    await page.goto(appUrl)
    await page.waitForLoadState('domcontentloaded')
    await use(page)

    if (errors.length > 0) {
      throw new Error(`Uncaught browser errors during test:\n${errors.join('\n')}`)
    }
  }
})
