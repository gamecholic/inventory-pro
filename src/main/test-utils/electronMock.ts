/** Minimal Electron stub for unit tests. The real package checks for (and downloads)
 * the binary at require time, which crashes test workers on machines without it (CI).
 * Main-process tests must stay Electron-free (see `db/client.ts`). */
export const app = {
  isPackaged: false,
  getPath: (): string => process.cwd(),
  getVersion: (): string => '0.0.0-test',
  quit: (): void => undefined
}

export const ipcMain = {
  handle: (): void => undefined,
  removeHandler: (): void => undefined
}

export const dialog = {
  showOpenDialog: async (): Promise<{ canceled: true; filePaths: string[] }> => ({ canceled: true, filePaths: [] }),
  showSaveDialog: async (): Promise<{ canceled: true; filePath: string }> => ({ canceled: true, filePath: '' }),
  showMessageBox: async (): Promise<{ response: number }> => ({ response: 1 }),
  showErrorBox: (): void => undefined
}

export const BrowserWindow = class {
  static getAllWindows(): unknown[] {
    return []
  }
}
