import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  businessSettings,
  defaultSettings,
  generalSettings,
  receiptSettings,
  settingsSections,
  withDefaults,
  type SettingsSection,
  type SettingsValues
} from '../../shared/settings'
import { toISO } from '../../shared/dates'
import { getDb } from './client'
import { settings } from './schema'

const sectionSchemas = { general: generalSettings, business: businessSettings, receipt: receiptSettings } as const

/** Read all settings rows, merged over defaults (tolerates partial/old data). */
export function getSettings(): SettingsValues {
  const rows = getDb().select().from(settings).all()
  const stored: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      stored[row.key] = JSON.parse(row.value) as unknown
    } catch {
      stored[row.key] = undefined
    }
  }
  return withDefaults(stored)
}

/**
 * Validate + persist one section (partial accepted). Returns the full merged settings.
 * Throws ZodError on invalid input.
 */
export function updateSettings(section: SettingsSection, patch: unknown): SettingsValues {
  const key = settingsSections.parse(section)
  const current = getSettings()
  const merged = sectionSchemas[key].parse({ ...current[key], ...(patch as Record<string, unknown>) })
  getDb()
    .insert(settings)
    .values({ key, value: JSON.stringify(merged), updatedAt: toISO(new Date()) })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(merged), updatedAt: toISO(new Date()) } })
    .run()
  return getSettings()
}

/** Seed defaults for sections missing from a fresh database. */
export function seedSettings(): void {
  const db = getDb()
  const existing = new Set(db.select({ key: settings.key }).from(settings).all().map((r) => r.key))
  const now = toISO(new Date())
  for (const [key, value] of Object.entries(defaultSettings)) {
    if (!existing.has(key)) db.insert(settings).values({ key, value: JSON.stringify(value), updatedAt: now }).run()
  }
}

export const updateSettingsInput = z.object({ section: settingsSections, patch: z.record(z.string(), z.unknown()) })
export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>
