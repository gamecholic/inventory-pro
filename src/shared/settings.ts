import { z } from 'zod'

/** Features §9.1 — General. Defaults: notifications on, scheduled backup off (§1.8). */
export const generalSettings = z.object({
  language: z.enum(['en', 'tr']),
  currency: z.enum(['USD', 'EUR', 'GBP', 'TRY']),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
  lowStockNotifications: z.boolean(),
  cardFeePercent: z.number().min(0).max(100),
  /** Hourly scheduled Excel backup (one file per day, latest hour). Replaces backup-on-close / auto-backup (§1.8). */
  scheduledBackup: z.boolean(),
  /** Local time of the last successful scheduled backup (ISO8601 UTC), null if never. Set by the server. */
  scheduledBackupLastAt: z.string().datetime({ offset: true }).nullable(),
  /** Custom scheduled-backup folder. Empty = app-managed default. Chosen via folder picker (§9.4). */
  backupDir: z.string().max(500),
  /** Start the app window maximized (full screen) on launch. */
  startMaximized: z.boolean(),
  /** Allow other devices on the LAN to reach the app (binds to 0.0.0.0). Requires restart. */
  networkAccess: z.boolean()
})

/** Features §9.2 — Business Information. All optional, shown on receipts when set (§1.4). */
export const businessSettings = z.object({
  name: z.string().max(200),
  address: z.string().max(1000),
  phone: z.string().max(50),
  email: z.union([z.literal(''), z.string().email().max(200)]),
  taxId: z.string().max(100)
})

/** Features §9.3 — Receipt Customization. */
export const receiptSettings = z.object({
  header: z.string().max(2000),
  footer: z.string().max(2000),
  showLogo: z.boolean()
})

export const settingsSections = z.enum(['general', 'business', 'receipt'])
export type SettingsSection = z.infer<typeof settingsSections>

export const settingsValues = z.object({
  general: generalSettings,
  business: businessSettings,
  receipt: receiptSettings
})
export type SettingsValues = z.infer<typeof settingsValues>

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Merge stored (possibly partial/old) values over defaults, section by section. */
export function withDefaults(stored: unknown): SettingsValues {
  const rec = isRecord(stored) ? stored : {}
  const generalStored: Record<string, unknown> = isRecord(rec.general) ? rec.general : {}
  // Migrate legacy flags: Electron backup-on-close and the Bun auto-backup
  // both become scheduledBackup when the new key was never set.
  if (generalStored.scheduledBackup === undefined) {
    if (typeof generalStored.autoBackup === 'boolean') {
      generalStored.scheduledBackup = generalStored.autoBackup
    } else if (typeof generalStored.backupOnClose === 'boolean') {
      generalStored.scheduledBackup = generalStored.backupOnClose
    }
  }
  delete generalStored.autoBackup
  delete generalStored.backupOnClose
  return {
    general: { ...defaultSettings.general, ...generalStored },
    business: { ...defaultSettings.business, ...(isRecord(rec.business) ? rec.business : {}) },
    receipt: { ...defaultSettings.receipt, ...(isRecord(rec.receipt) ? rec.receipt : {}) }
  }
}

export const defaultSettings: SettingsValues = {
  general: {
    language: 'en',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    lowStockNotifications: true,
    cardFeePercent: 0.68,
    scheduledBackup: false,
    scheduledBackupLastAt: null,
    backupDir: '',
    startMaximized: false,
    networkAccess: false
  },
  business: { name: '', address: '', phone: '', email: '', taxId: '' },
  receipt: { header: '', footer: 'Thank you for your purchase!', showLogo: false }
}
