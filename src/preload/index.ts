import { contextBridge, ipcRenderer } from 'electron'
import { createApi, type Invoke } from '../shared/api-surface'

export type { AppApi, BackupDirInfo, DbInfo, ImportResult } from '../shared/api-surface'

// Electron transport: one `invoke` per channel. The Bun build swaps this for
// `fetch` (src/renderer/lib/http-api.ts) and reuses the same createApi object.
const invoke: Invoke = (channel, payload) => ipcRenderer.invoke(channel, payload)

contextBridge.exposeInMainWorld('api', createApi(invoke))
