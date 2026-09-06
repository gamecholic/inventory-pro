import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { settingsValues, withDefaults, type SettingsValues } from '../../shared/settings'
import { toISO } from '../../shared/dates'
import { getDb, getSqlite } from './client'
import { categories, expenseCategories, expenses, products, saleItems, sales, settings } from './schema'
import { seedSettings } from './settingsStore'

const BACKUP_VERSION = 2
export { BACKUP_VERSION }

const rowRecord = z.record(z.string(), z.unknown())
const backupFile = z.object({
  app: z.literal('inventory-pro'),
  version: z.number(),
  exportedAt: z.string(),
  settings: z.unknown(),
  categories: z.array(rowRecord),
  products: z.array(rowRecord),
  sales: z.array(rowRecord).default([]),
  sale_items: z.array(rowRecord).default([]),
  expense_categories: z.array(rowRecord).default([]),
  expenses: z.array(rowRecord).default([])
})
export type BackupFile = z.infer<typeof backupFile>

export interface TableDump {
  settings: SettingsValues
  categories: Array<typeof categories.$inferSelect>
  products: Array<typeof products.$inferSelect>
  sales: Array<typeof sales.$inferSelect>
  sale_items: Array<typeof saleItems.$inferSelect>
  expense_categories: Array<typeof expenseCategories.$inferSelect>
  expenses: Array<typeof expenses.$inferSelect>
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
    products: db.select().from(products).all(),
    sales: db.select().from(sales).all(),
    sale_items: db.select().from(saleItems).all(),
    expense_categories: db.select().from(expenseCategories).all(),
    expenses: db.select().from(expenses).all()
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
    sqlite.prepare('DELETE FROM sale_items').run()
    sqlite.prepare('DELETE FROM sales').run()
    sqlite.prepare('DELETE FROM expenses').run()
    sqlite.prepare('DELETE FROM expense_categories').run()
    sqlite.prepare('DELETE FROM products').run()
    sqlite.prepare('DELETE FROM categories').run()
    sqlite.prepare('DELETE FROM settings').run()
    const now = toISO(new Date())
    const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
    const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
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
    const insertSale = sqlite.prepare(
      'INSERT INTO sales (id, receipt_no, created_at, subtotal, discount, total, payment_method, cash_amount, card_amount, change_amount, status, canceled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const s of parsed.sales) {
      insertSale.run(
        typeof s.id === 'number' ? s.id : null,
        typeof s.receipt_no === 'string' ? s.receipt_no : `RESTORED-${String(s.id ?? '?')}`,
        typeof s.created_at === 'string' ? s.created_at : now,
        num(s.subtotal, 0),
        num(s.discount, 0),
        num(s.total, 0),
        typeof s.payment_method === 'string' ? s.payment_method : 'cash',
        typeof s.cash_amount === 'number' ? s.cash_amount : null,
        typeof s.card_amount === 'number' ? s.card_amount : null,
        num(s.change_amount, 0),
        typeof s.status === 'string' ? s.status : 'completed',
        str(s.canceled_at)
      )
    }
    const insertItem = sqlite.prepare(
      'INSERT INTO sale_items (id, sale_id, product_id, product_name, unit, qty, unit_price, unit_cost, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const i of parsed.sale_items) {
      insertItem.run(
        typeof i.id === 'number' ? i.id : null,
        typeof i.sale_id === 'number' ? i.sale_id : null,
        typeof i.product_id === 'number' ? i.product_id : null,
        typeof i.product_name === 'string' ? i.product_name : '',
        typeof i.unit === 'string' ? i.unit : 'pcs',
        num(i.qty, 0),
        num(i.unit_price, 0),
        num(i.unit_cost, 0),
        num(i.line_total, 0)
      )
    }
    const insertExpCat = sqlite.prepare('INSERT INTO expense_categories (id, name, description, created_at) VALUES (?, ?, ?, ?)')
    for (const c of parsed.expense_categories) {
      insertExpCat.run(
        typeof c.id === 'number' ? c.id : null,
        typeof c.name === 'string' ? c.name : '',
        typeof c.description === 'string' ? c.description : null,
        typeof c.created_at === 'string' ? c.created_at : now
      )
    }
    const insertExp = sqlite.prepare(
      'INSERT INTO expenses (id, date, amount, description, category_id, payment_method, recipient, reference, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const e of parsed.expenses) {
      insertExp.run(
        typeof e.id === 'number' ? e.id : null,
        typeof e.date === 'string' ? e.date : now,
        num(e.amount, 0),
        typeof e.description === 'string' ? e.description : '',
        typeof e.category_id === 'number' ? e.category_id : null,
        typeof e.payment_method === 'string' ? e.payment_method : 'cash',
        str(e.recipient),
        str(e.reference),
        str(e.notes),
        typeof e.created_at === 'string' ? e.created_at : now,
        typeof e.updated_at === 'string' ? e.updated_at : now
      )
    }
  })
  run()
  return { categories: parsed.categories.length, products: parsed.products.length }
}

/** Delete everything and reseed defaults. */
export function resetDatabase(): void {
  const sqlite = getSqlite()
  sqlite.prepare('DELETE FROM sale_items').run()
  sqlite.prepare('DELETE FROM sales').run()
  sqlite.prepare('DELETE FROM expenses').run()
  sqlite.prepare('DELETE FROM expense_categories').run()
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
