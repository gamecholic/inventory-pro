import { app, ipcMain } from 'electron'
import pkg from 'electron-updater'
import { updaterCheck, updaterProgress, type UpdaterCheck, type UpdaterProgress } from '../../shared/updater'

// electron-updater is CommonJS with a lazily-defined export: Node's ESM loader
// cannot see the named export, so go through the default export (CJS module object).
const { autoUpdater } = pkg

let lastPercent = 0

/** GitHub Releases update feed (architecture §1). Renderer polls on launch; no auto-download. */
export function registerUpdaterIpc(): void {
  autoUpdater.autoDownload = false
  autoUpdater.on('download-progress', (info) => {
    lastPercent = Math.min(100, Math.max(0, info.percent))
  })

  ipcMain.handle('updater:check', async (): Promise<UpdaterCheck> => {
    if (!app.isPackaged) return { status: 'up-to-date' }
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result?.updateInfo) {
        return updaterCheck.parse({ status: 'available', version: result.updateInfo.version })
      }
      return { status: 'up-to-date' }
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('updater:download', async (): Promise<UpdaterCheck> => {
    lastPercent = 0
    try {
      await autoUpdater.downloadUpdate()
      return { status: 'downloaded' }
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('updater:progress', (): UpdaterProgress => updaterProgress.parse({ percent: lastPercent }))

  ipcMain.handle('updater:install', (): boolean => {
    autoUpdater.quitAndInstall()
    return true
  })
}
