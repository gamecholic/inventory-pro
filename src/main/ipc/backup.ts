import { app, dialog, ipcMain, shell } from 'electron'
import { dbDirInput } from '../../shared/api'
import { getCustomDbDir, getDbInfo, setDbDir, type DbInfo } from '../db/client'
import {
  backupDir,
  fromBackupJson,
  getBackupDirInfo,
  readTextFile,
  resetDatabase,
  toBackupJson,
  writeTextFile,
  type BackupDirInfo
} from '../db/backup'
import { readExcelBackup, writeExcelBackup } from '../db/excel'
import { readLegacyExcelBackup } from '../db/legacyExcel'

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

  ipcMain.handle('backup:import-legacy-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import from old app Excel',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    const counts = await readLegacyExcelBackup(filePaths[0] as string)
    return { filePath: filePaths[0], ...counts }
  })

  ipcMain.handle('db:reset', () => {
    resetDatabase()
    return true
  })

  ipcMain.handle('db:dir', (): DbInfo => getDbInfo())

  ipcMain.handle('db:select-dir', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choose database folder',
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0] as string
  })

  ipcMain.handle('db:set-dir', (_event, input: unknown): DbInfo => setDbDir(dbDirInput.parse(input).dir))

  ipcMain.handle('db:open-dir', async (): Promise<boolean> => {
    const custom = getCustomDbDir()
    const error = await shell.openPath(custom !== '' ? custom : app.getPath('userData'))
    return error === ''
  })

  ipcMain.handle('backup:dir', (): BackupDirInfo => getBackupDirInfo())

  ipcMain.handle('backup:select-dir', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choose backup folder',
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0] as string
  })

  ipcMain.handle('backup:open-dir', async (): Promise<boolean> => {
    const error = await shell.openPath(backupDir())
    return error === ''
  })
}
