import { ipcMain } from 'electron'
import { getSettings, updateSettings, updateSettingsInput } from '../db/settingsStore'
import { syncAutostart } from '../autostart'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:update', (_event, input: unknown) => {
    const { section, patch } = updateSettingsInput.parse(input)
    const result = updateSettings(section, patch)
    // Apply OS-level side effects for General settings that have them.
    // A registry failure must not fail the save — the launch-time sync in
    // boot.ts retries, and the DB remains the source of truth.
    if (section === 'general') {
      const autoStart = (patch as Record<string, unknown>).autoStartOnLogin
      if (typeof autoStart === 'boolean') {
        try {
          syncAutostart(autoStart)
        } catch (error) {
          console.error(`autostart sync failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    return result
  })
}
