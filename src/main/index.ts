import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null
// Reads Settings.backupOnClose in the future; default off (features §1.8).
let backupOnCloseEnabled = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Backup prompt on close (features §1.8). Disabled by default → close directly.
  mainWindow.on('close', (event) => {
    if (!backupOnCloseEnabled || mainWindow?.isDestroyed()) return
    event.preventDefault()
    void dialog
      .showMessageBox(mainWindow!, {
        type: 'question',
        title: 'Close Application',
        message: 'Do you want to export an Excel backup before closing?',
        buttons: ['Yes', 'No', 'Cancel'],
        defaultId: 1,
        cancelId: 2
      })
      .then(({ response }) => {
        if (response === 2) return // Cancel: stay open
        if (response === 0) {
          // Yes: export Excel backup first (implemented with Database Management §9.4).
          backupOnCloseEnabled = false
          // TODO: run Excel export, show Backup Complete/Failed, then close.
          mainWindow?.close()
          return
        }
        // No: close immediately.
        backupOnCloseEnabled = false
        mainWindow?.close()
      })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.inventorypro.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  ipcMain.handle('app:ping', () => 'pong')
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
