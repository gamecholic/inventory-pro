/**
 * Minimal `electron` stand-in for the Bun build.
 *
 * The point of this file: `src/main/db/*` and `src/main/ipc/*` import from
 * 'electron' in four places (`app`, `ipcMain`, `dialog`, `shell`). Aliasing the
 * module to this shim (see tsconfig.bun.json) means those files run unmodified
 * under Bun. It is a stepping stone, not the end state — the guide explains how
 * to delete it later by importing the handlers directly.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

type Handler = (event: unknown, payload: unknown) => unknown

/** Channel -> handler. Filled by the register*Ipc() functions. */
export const handlers = new Map<string, Handler>()

export const ipcMain = {
  handle(channel: string, fn: Handler): void {
    handlers.set(channel, fn)
  }
}

/**
 * Same folder Electron used (%APPDATA%\Inventory Pro), so the Bun build opens
 * the existing shop database instead of starting empty. Override with
 * INVENTORY_DATA_DIR for a throwaway instance.
 */
function dataDir(): string {
  return process.env.INVENTORY_DATA_DIR ?? join(process.env.APPDATA ?? homedir(), 'Inventory Pro')
}

let version = '0.0.0'
try {
  version = (JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { version: string }).version
} catch {
  // keep the fallback; the version only feeds the header and update check
}

export const app = {
  getPath(_name: 'userData' | string): string {
    const dir = dataDir()
    mkdirSync(dir, { recursive: true })
    return dir
  },
  getVersion(): string {
    // The compiled exe has no package.json beside it: server/boot.ts bakes the
    // version into the binary and passes it through this variable.
    return process.env.INVENTORY_VERSION ?? version
  },
  isPackaged: false
}

/**
 * Native file dialogs have no server-side equivalent. The backup routes are
 * overridden in server/index.ts to write into the backup folder and to accept
 * uploaded files, so these should never be reached.
 */
export const dialog = {
  async showSaveDialog(): Promise<{ canceled: boolean; filePath: undefined }> {
    return { canceled: true, filePath: undefined }
  },
  async showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }> {
    return { canceled: true, filePaths: [] }
  }
}

export const shell = {
  async openPath(path: string): Promise<string> {
    spawn('explorer.exe', [path], { detached: true, stdio: 'ignore' }).unref()
    return ''
  }
}
