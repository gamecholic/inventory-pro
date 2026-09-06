import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getDb } from './db/client'
import { getSettings } from './db/settingsStore'
import { defaultBackupPath, registerIpc, writeExcelBackup } from './ipc'

let mainWindow: BrowserWindow | null = null
let closingAfterBackupChoice = false

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

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Backup prompt on close (features §1.8). Reads the live setting every time.
  mainWindow.on('close', (event) => {
    if (closingAfterBackupChoice || mainWindow?.isDestroyed()) return
    let backupOnClose: boolean
    try {
      backupOnClose = getSettings().general.backupOnClose
    } catch {
      backupOnClose = false
    }
    if (!backupOnClose) return
    event.preventDefault()
    void (async () => {
      const { response } = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        title: 'Close Application',
        message: 'Do you want to export an Excel backup before closing?',
        buttons: ['Yes', 'No', 'Cancel'],
        defaultId: 1,
        cancelId: 2
      })
      if (response === 2) return // Cancel: stay open
      closingAfterBackupChoice = true
      if (response === 0) {
        try {
          const filePath = defaultBackupPath()
          await writeExcelBackup(filePath)
          await dialog.showMessageBox(mainWindow!, {
            type: 'info',
            title: 'Backup Complete',
            message: `Backup saved to:\n${filePath}`
          })
        } catch (error) {
          await dialog.showMessageBox(mainWindow!, {
            type: 'error',
            title: 'Backup Failed',
            message: error instanceof Error ? error.message : String(error)
          })
        }
      }
      mainWindow?.close()
    })()
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
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
