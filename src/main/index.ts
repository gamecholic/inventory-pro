import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getDb } from './db/client'
import { getSettings } from './db/settingsStore'
import { registerIpc } from './ipc'
import { startScheduledBackups, stopScheduledBackups } from './scheduledBackup'

let mainWindow: BrowserWindow | null = null

// Dev-only shared session: expose renderer over CDP so a local agent can
// attach to the same `npm run dev` window (console / network / DOM).
if (is.dev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
  app.commandLine.appendSwitch('remote-allow-origins', '*')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    try {
      if (getSettings().general.startMaximized) {
        mainWindow?.maximize()
      }
    } catch {
      // ignore missing settings on first run
    }
    mainWindow?.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.inventorypro.app')
  try {
    getDb()
  } catch (error) {
    dialog.showErrorBox('Database failed to open', error instanceof Error ? error.message : String(error))
    app.quit()
    return
  }
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  registerIpc()
  // Hourly scheduled backup (features §1.8): on the hour, one file per day
  // (latest hour). Success is silent (time recorded for Settings); a failure
  // shows a toast. Reads the live setting each tick, so toggling takes
  // effect without a restart. No backup at launch — first run is next hour.
  startScheduledBackups()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopScheduledBackups()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
