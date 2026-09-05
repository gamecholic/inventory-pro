import { ipcMain } from 'electron'
import { defaultBackupPath } from '../db/backup'
import { writeExcelBackup } from '../db/excel'
import { registerBackupIpc } from './backup'
import { registerCatalogIpc } from './catalog'
import { registerSalesIpc } from './sales'
import { registerSettingsIpc } from './settings'

/** All IPC handlers. Payloads validated with Zod in main; renderer shows thrown messages. */
export function registerIpc(): void {
  ipcMain.handle('app:ping', () => 'pong')
  registerSettingsIpc()
  registerBackupIpc()
  registerCatalogIpc()
  registerSalesIpc()
}

export { defaultBackupPath, writeExcelBackup }
