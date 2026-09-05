import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { settingsValues, withDefaults, type SettingsValues } from '../../shared/settings'
import { toISO } from '../../shared/dates'
import { getDb, getSqlite } from './client'
import { categories, products, settings } from './schema'
import { seedSettings } from './settingsStore'

const BACKUP_VERSION = 1

const rowRecord = z.record(z.string(), z.unknown())
const backupFile = z.object({
  app: z.literal('inventory-pro'),
  version: z.number(),
  exportedAt: z.string(),
  settings: z.unknown(),
  categories: z.array(rowRecord),
  products: z.array(rowRecord)
})
export type BackupFile = z.infer<typeof backupFile>

export interface TableDump {
  settings: SettingsValues
  categories: Array<typeof categories.$inferSelect>
  products: Array<typeof products.$inferSelect>
}

/** Read every user table. Dates/amounts stay as stored; exportedAt is ISO8601 UTC. */
export function collectAll(): TableDump {
  const db = getDb()
  return {
    settings: withDefaults(
      Object.fromEntries(
        db
          .select()
          .from(settings)
          .all()
          .map((r) => [r.key, JSON.parse(r.value) as unknown])
      )
    ),
    categories: db.select().from(categories).all(),
    products: db.select().from(products).all()
  }
}

/**
 * Replace all user data in one transaction. Validates settings strictly;
 * table rows must be plain objects. Throws on invalid input — DB untouched.
 */
export function replaceAll(data: unknown): { categories: number; products: number } {
  const parsed = backupFile.parse(data)
  const validatedSettings = settingsValues.parse(withDefaults(parsed.settings))
  const sqlite = getSqlite()
  const run = sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM products').run()
    sqlite.prepare('DELETE FROM categories').run()
    sqlite.prepare('DELETE FROM settings').run()
    const now = toISO(new Date())
    for (const [key, value] of Object.entries(validatedSettings)) {
      sqlite.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), now)
    }
    const insertCat = sqlite.prepare('INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)')
    for (const c of parsed.categories) {
      insertCat.run(
        typeof c.id === 'number' ? c.id : null,
        typeof c.name === 'string' ? c.name : '',
        typeof c.description === 'string' ? c.description : null,
        typeof c.created_at === 'string' ? c.created_at : now
      )
    }
    const insertProd = sqlite.prepare(
      'INSERT INTO products (id, name, barcode, category_id, unit, selling_price, cost_price, stock_qty, min_stock, supplier_id, description, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const p of parsed.products) {
      const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
      const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
      insertProd.run(
        typeof p.id === 'number' ? p.id : null,
        typeof p.name === 'string' ? p.name : '',
        str(p.barcode),
        typeof p.category_id === 'number' ? p.category_id : null,
        typeof p.unit === 'string' ? p.unit : 'pcs',
        num(p.selling_price, 0),
        num(p.cost_price, 0),
        num(p.stock_qty, 0),
        num(p.min_stock, 5),
        typeof p.supplier_id === 'number' ? p.supplier_id : null,
        str(p.description),
        str(p.archived_at),
        typeof p.created_at === 'string' ? p.created_at : now,
        typeof p.updated_at === 'string' ? p.updated_at : now
      )
    }
  })
  run()
  return { categories: parsed.categories.length, products: parsed.products.length }
}

/** Delete everything and reseed defaults. */
export function resetDatabase(): void {
  const sqlite = getSqlite()
  sqlite.prepare('DELETE FROM products').run()
  sqlite.prepare('DELETE FROM categories').run()
  sqlite.prepare('DELETE FROM settings').run()
  seedSettings()
}

export function toBackupJson(): string {
  const dump = collectAll()
  const file: BackupFile = {
    app: 'inventory-pro',
    version: BACKUP_VERSION,
    exportedAt: toISO(new Date()),
    ...dump
  }
  return JSON.stringify(file, null, 2)
}

export function fromBackupJson(text: string): { categories: number; products: number } {
  return replaceAll(JSON.parse(text) as unknown)
}

const PRODUCT_COLUMNS = [
  'id',
  'name',
  'barcode',
  'category_id',
  'unit',
  'selling_price',
  'cost_price',
  'stock_qty',
  'min_stock',
  'supplier_id',
  'description',
  'archived_at',
  'created_at',
  'updated_at'
] as const

/** One workbook, one sheet per table. First row is the header. */
export async function writeExcelBackup(filePath: string): Promise<void> {
  const dump = collectAll()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Inventory Pro'
  wb.created = new Date()
  const settingsSheet = wb.addWorksheet('Settings')
  settingsSheet.columns = [
    { header: 'key', key: 'key', width: 20 },
    { header: 'value', key: 'value', width: 80 }
  ]
  for (const [key, value] of Object.entries(dump.settings)) {
    settingsSheet.addRow({ key, value: JSON.stringify(value) })
  }
  const catSheet = wb.addWorksheet('Categories')
  catSheet.columns = [
    { header: 'id', key: 'id', width: 8 },
    { header: 'name', key: 'name', width: 30 },
    { header: 'description', key: 'description', width: 50 },
    { header: 'created_at', key: 'created_at', width: 28 }
  ]
  for (const c of dump.categories) catSheet.addRow(c)
  const prodSheet = wb.addWorksheet('Products')
  prodSheet.columns = PRODUCT_COLUMNS.map((h) => ({ header: h, key: h, width: h === 'name' ? 30 : 16 }))
  for (const p of dump.products) prodSheet.addRow({ ...p })
  await wb.xlsx.writeFile(filePath)
}

/** Read a workbook written by writeExcelBackup and replace all data. */
export async function readExcelBackup(filePath: string): Promise<{ categories: number; products: number }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const getSheet = (name: string): ExcelJS.Worksheet => {
    const sheet = wb.getWorksheet(name)
    if (!sheet) throw new Error(`Missing sheet: ${name}`)
    return sheet
  }
  const settingsObj: Record<string, unknown> = {}
  getSheet('Settings').eachRow((row, n) => {
    if (n === 1) return
    const key = String(row.getCell(1).value ?? '')
    const raw = row.getCell(2).value
    if (key) {
      try {
        settingsObj[key] = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
      } catch {
        settingsObj[key] = undefined
      }
    }
  })
  const readRows = (sheet: ExcelJS.Worksheet): Array<Record<string, unknown>> => {
    const header = (sheet.getRow(1).values ?? []) as unknown[]
    const rows: Array<Record<string, unknown>> = []
    sheet.eachRow((row, n) => {
      if (n === 1) return
      const values = (row.values ?? []) as unknown[]
      const rec: Record<string, unknown> = {}
      for (let i = 1; i < header.length; i++) {
        const name = header[i]
        if (typeof name === 'string') rec[name] = values[i] ?? null
      }
      rows.push(rec)
    })
    return rows
  }
  return replaceAll({
    app: 'inventory-pro',
    version: BACKUP_VERSION,
    exportedAt: toISO(new Date()),
    settings: settingsObj,
    categories: readRows(getSheet('Categories')),
    products: readRows(getSheet('Products'))
  })
}

export function defaultBackupPath(): string {
  const dir = join(app.getPath('userData'), 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const stamp = toISO(new Date()).replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return join(dir, `inventory-${stamp}.xlsx`)
}

export function writeTextFile(filePath: string, text: string): void {
  writeFileSync(filePath, text, 'utf-8')
}

export function readTextFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}
