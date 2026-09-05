import { contextBridge, ipcRenderer } from 'electron'
import type {
  CategoryInput,
  CategoryRow,
  ProductInput,
  ProductList,
  ProductListFilter,
  ProductRow,
  SupplierInput,
  SupplierRow
} from '../shared/products'
import type { SettingsSection, SettingsValues } from '../shared/settings'

export interface ImportResult {
  filePath: string
  categories: number
  products: number
}

const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),
  settings: {
    get: (): Promise<SettingsValues> => ipcRenderer.invoke('settings:get'),
    update: (section: SettingsSection, patch: Record<string, unknown>): Promise<SettingsValues> =>
      ipcRenderer.invoke('settings:update', { section, patch })
  },
  backup: {
    exportJson: (): Promise<string | null> => ipcRenderer.invoke('backup:export-json'),
    importJson: (): Promise<ImportResult | null> => ipcRenderer.invoke('backup:import-json'),
    exportExcel: (): Promise<string | null> => ipcRenderer.invoke('backup:export-excel'),
    importExcel: (): Promise<ImportResult | null> => ipcRenderer.invoke('backup:import-excel')
  },
  db: {
    reset: (): Promise<boolean> => ipcRenderer.invoke('db:reset')
  },
  products: {
    list: (filter: ProductListFilter): Promise<ProductList> => ipcRenderer.invoke('products:list', filter),
    create: (input: ProductInput): Promise<ProductRow> => ipcRenderer.invoke('products:create', input),
    update: (id: number, input: ProductInput): Promise<ProductRow> =>
      ipcRenderer.invoke('products:update', { ...input, id }),
    archive: (id: number): Promise<boolean> => ipcRenderer.invoke('products:archive', { id }),
    restore: (id: number): Promise<boolean> => ipcRenderer.invoke('products:restore', { id })
  },
  categories: {
    list: (): Promise<CategoryRow[]> => ipcRenderer.invoke('categories:list'),
    create: (input: CategoryInput): Promise<CategoryRow> => ipcRenderer.invoke('categories:create', input),
    update: (id: number, input: CategoryInput): Promise<CategoryRow> =>
      ipcRenderer.invoke('categories:update', { ...input, id }),
    remove: (id: number): Promise<boolean> => ipcRenderer.invoke('categories:delete', { id })
  },
  suppliers: {
    list: (): Promise<SupplierRow[]> => ipcRenderer.invoke('suppliers:list'),
    create: (input: SupplierInput): Promise<SupplierRow> => ipcRenderer.invoke('suppliers:create', input),
    update: (id: number, input: SupplierInput): Promise<SupplierRow> =>
      ipcRenderer.invoke('suppliers:update', { ...input, id }),
    remove: (id: number): Promise<boolean> => ipcRenderer.invoke('suppliers:delete', { id })
  }
}

export type AppApi = typeof api

contextBridge.exposeInMainWorld('api', api)
