import { contextBridge, ipcRenderer } from 'electron'

const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping')
}

export type AppApi = typeof api

contextBridge.exposeInMainWorld('api', api)
