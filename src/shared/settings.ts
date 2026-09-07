import { z } from 'zod'

/** Features §9.1 — General. Defaults: notifications on, backup-on-close off (§1.8). */
export const generalSettings = z.object({
  language: z.enum(['en', 'tr']),
  currency: z.enum(['USD', 'EUR', 'GBP', 'TRY']),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
  lowStockNotifications: z.boolean(),
  cardFeePercent: z.number().min(0).max(100),
  backupOnClose: z.boolean(),
  /** Custom close-backup folder. Empty = app-managed default. Chosen via folder picker (§9.4). */
  backupDir: z.string().max(500)
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
  return {
    general: { ...defaultSettings.general, ...(isRecord(rec.general) ? rec.general : {}) },
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
    backupOnClose: false,
    backupDir: ''
  },
  business: { name: '', address: '', phone: '', email: '', taxId: '' },
  receipt: { header: '', footer: 'Thank you for your purchase!', showLogo: false }
}
