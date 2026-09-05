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
import {
  archiveProduct,
  createCategory,
  createProduct,
  createSupplier,
  deleteCategory,
  deleteSupplier,
  listCategories,
  listProducts,
  listSuppliers,
  restoreProduct,
  updateCategory,
  updateProduct,
  updateSupplier
} from './db/catalog'
import {
  categoryInput,
  productId,
  productInput,
  productListFilter,
  supplierInput,
  updateCategoryInput,
  updateProductInput,
  updateSupplierInput
} from '../shared/products'
import { idInput } from '../shared/api'

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

  ipcMain.handle('products:list', (_event, input: unknown) => listProducts(productListFilter.parse(input)))
  ipcMain.handle('products:create', (_event, input: unknown) => createProduct(productInput.parse(input)))
  ipcMain.handle('products:update', (_event, input: unknown) => {
    const { id, ...patch } = updateProductInput.parse(input)
    return updateProduct(id, productInput.parse(patch))
  })
  ipcMain.handle('products:archive', (_event, input: unknown) => {
    archiveProduct(productId.parse(input).id)
    return true
  })
  ipcMain.handle('products:restore', (_event, input: unknown) => {
    restoreProduct(productId.parse(input).id)
    return true
  })

  ipcMain.handle('categories:list', () => listCategories())
  ipcMain.handle('categories:create', (_event, input: unknown) => createCategory(categoryInput.parse(input)))
  ipcMain.handle('categories:update', (_event, input: unknown) => {
    const { id, ...patch } = updateCategoryInput.parse(input)
    return updateCategory(id, categoryInput.parse(patch))
  })
  ipcMain.handle('categories:delete', (_event, input: unknown) => {
    deleteCategory(idInput.parse(input).id)
    return true
  })

  ipcMain.handle('suppliers:list', () => listSuppliers())
  ipcMain.handle('suppliers:create', (_event, input: unknown) => createSupplier(supplierInput.parse(input)))
  ipcMain.handle('suppliers:update', (_event, input: unknown) => {
    const { id, ...patch } = updateSupplierInput.parse(input)
    return updateSupplier(id, supplierInput.parse(patch))
  })
  ipcMain.handle('suppliers:delete', (_event, input: unknown) => {
    deleteSupplier(idInput.parse(input).id)
    return true
  })
}

export { defaultBackupPath, writeExcelBackup }
