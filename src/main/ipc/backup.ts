import { dialog, ipcMain } from 'electron'
import {
  fromBackupJson,
  readTextFile,
  resetDatabase,
  toBackupJson,
  writeTextFile
} from '../db/backup'
import { readExcelBackup, writeExcelBackup } from '../db/excel'

export function registerBackupIpc(): void {
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
