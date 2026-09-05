import { dialog, ipcMain } from 'electron'
import {
  defaultBackupPath,
  fromBackupJson,
  readExcelBackup,
  readTextFile,
  resetDatabase,
  toBackupJson,
  writeExcelBackup,
  writeTextFile
} from './db/backup'
import { getSettings, updateSettings, updateSettingsInput } from './db/settingsStore'

/** All IPC handlers. Payloads validated with Zod in main; renderer shows thrown messages. */
export function registerIpc(): void {
  ipcMain.handle('app:ping', () => 'pong')

  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:update', (_event, input: unknown) => {
    const { section, patch } = updateSettingsInput.parse(input)
    return updateSettings(section, patch)
  })

  ipcMain.handle('backup:export-json', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export JSON backup',
      defaultPath: 'inventory-backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null
    writeTextFile(filePath, toBackupJson())
    return filePath
  })

  ipcMain.handle('backup:import-json', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import JSON backup',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    const counts = fromBackupJson(readTextFile(filePaths[0] as string))
    return { filePath: filePaths[0], ...counts }
  })

  ipcMain.handle('backup:export-excel', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Excel backup',
      defaultPath: 'inventory-backup.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (canceled || !filePath) return null
    await writeExcelBackup(filePath)
    return filePath
  })

  ipcMain.handle('backup:import-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Excel backup',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    const counts = await readExcelBackup(filePaths[0] as string)
    return { filePath: filePaths[0], ...counts }
  })

  ipcMain.handle('db:reset', () => {
    resetDatabase()
    return true
  })
}

export { defaultBackupPath, writeExcelBackup }
