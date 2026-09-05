import { contextBridge, ipcRenderer } from 'electron'
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
  }
}

export type AppApi = typeof api

contextBridge.exposeInMainWorld('api', api)
