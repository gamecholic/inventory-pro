import { app, ipcMain } from 'electron'
import { defaultBackupPath } from '../db/backup'
import { writeExcelBackup } from '../db/excel'
import { registerAnalyticsIpc } from './analytics'
import { registerBackupIpc } from './backup'
import { registerCatalogIpc } from './catalog'
import { registerExpensesIpc } from './expenses'
import { registerSalesIpc } from './sales'
import { registerSettingsIpc } from './settings'
import { registerUpdaterIpc } from './updater'

/** All IPC handlers. Payloads validated with Zod in main; renderer shows thrown messages. */
export function registerIpc(): void {
  ipcMain.handle('app:ping', () => 'pong')
  ipcMain.handle('app:version', () => app.getVersion())
  registerSettingsIpc()
  registerBackupIpc()
  registerCatalogIpc()
  registerExpensesIpc()
  registerAnalyticsIpc()
  registerSalesIpc()
  registerUpdaterIpc()
}

export { defaultBackupPath, writeExcelBackup }
