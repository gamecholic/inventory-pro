import { ipcMain } from 'electron'
import { getSettings, updateSettings, updateSettingsInput } from '../db/settingsStore'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:update', (_event, input: unknown) => {
    const { section, patch } = updateSettingsInput.parse(input)
    return updateSettings(section, patch)
  })
}
