import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { settingsValues, withDefaults, type SettingsValues } from '../../shared/settings'
import { toISO } from '../../shared/dates'
import { getDb, getSqlite } from './client'
import { categories, expenseCategories, expenses, products, saleItems, sales, settings, stockAdjustments, suppliers } from './schema'
import { getSettings, seedSettings } from './settingsStore'

const BACKUP_VERSION = 3
export { BACKUP_VERSION }

const rowRecord = z.record(z.string(), z.unknown())
const backupFile = z.object({
  app: z.literal('inventory-pro'),
  version: z.number(),
  exportedAt: z.string(),
  settings: z.unknown(),
  categories: z.array(rowRecord),
  suppliers: z.array(rowRecord).default([]),
  products: z.array(rowRecord),
  sales: z.array(rowRecord).default([]),
  sale_items: z.array(rowRecord).default([]),
  expense_categories: z.array(rowRecord).default([]),
  expenses: z.array(rowRecord).default([]),
  stock_adjustments: z.array(rowRecord).default([])
})
export type BackupFile = z.infer<typeof backupFile>

/**
 * Backup file format uses snake_case DB column names (stable on-disk format).
 * Drizzle returns camelCase, so collectAll() maps to snake_case and
 * replaceAll() accepts both (old JSON backups were written with camelCase).
 */
export interface TableDump {
  settings: SettingsValues
  categories: Array<Record<string, unknown>>
  suppliers: Array<Record<string, unknown>>
  products: Array<Record<string, unknown>>
  sales: Array<Record<string, unknown>>
  sale_items: Array<Record<string, unknown>>
  expense_categories: Array<Record<string, unknown>>
  expenses: Array<Record<string, unknown>>
  stock_adjustments: Array<Record<string, unknown>>
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
    categories: db
      .select()
      .from(categories)
      .all()
      .map((c) => ({ id: c.id, name: c.name, description: c.description, created_at: c.createdAt })),
    suppliers: db
      .select()
      .from(suppliers)
      .all()
      .map((s) => ({
        id: s.id,
        company_name: s.companyName,
        contact_person: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
        created_at: s.createdAt,
        updated_at: s.updatedAt
      })),
    products: db
      .select()
      .from(products)
      .all()
      .map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        category_id: p.categoryId,
        unit: p.unit,
        selling_price: p.sellingPrice,
        cost_price: p.costPrice,
        stock_qty: p.stockQty,
        min_stock: p.minStock,
        supplier_id: p.supplierId,
        description: p.description,
        archived_at: p.archivedAt,
        created_at: p.createdAt,
        updated_at: p.updatedAt
      })),
    sales: db
      .select()
      .from(sales)
      .all()
      .map((s) => ({
        id: s.id,
        receipt_no: s.receiptNo,
        created_at: s.createdAt,
        subtotal: s.subtotal,
        discount: s.discount,
        total: s.total,
        payment_method: s.paymentMethod,
        cash_amount: s.cashAmount,
        card_amount: s.cardAmount,
        change_amount: s.changeAmount,
        status: s.status,
        canceled_at: s.canceledAt
      })),
    sale_items: db
      .select()
      .from(saleItems)
      .all()
      .map((i) => ({
        id: i.id,
        sale_id: i.saleId,
        product_id: i.productId,
        product_name: i.productName,
        unit: i.unit,
        qty: i.qty,
        unit_price: i.unitPrice,
        unit_cost: i.unitCost,
        line_total: i.lineTotal
      })),
    expense_categories: db
      .select()
      .from(expenseCategories)
      .all()
      .map((c) => ({ id: c.id, name: c.name, description: c.description, created_at: c.createdAt })),
    expenses: db
      .select()
      .from(expenses)
      .all()
      .map((e) => ({
        id: e.id,
        date: e.date,
        amount: e.amount,
        description: e.description,
        category_id: e.categoryId,
        payment_method: e.paymentMethod,
        recipient: e.recipient,
        reference: e.reference,
        notes: e.notes,
        created_at: e.createdAt,
        updated_at: e.updatedAt
      })),
    stock_adjustments: db
      .select()
      .from(stockAdjustments)
      .all()
      .map((a) => ({
        id: a.id,
        product_id: a.productId,
        qty_change: a.qtyChange,
        type: a.type,
        reason: a.reason,
        cost_price: a.costPrice,
        selling_price: a.sellingPrice,
        created_at: a.createdAt
      }))
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
    sqlite.prepare('DELETE FROM stock_adjustments').run()
    sqlite.prepare('DELETE FROM sale_items').run()
    sqlite.prepare('DELETE FROM sales').run()
    sqlite.prepare('DELETE FROM expenses').run()
    sqlite.prepare('DELETE FROM expense_categories').run()
    sqlite.prepare('DELETE FROM products').run()
    sqlite.prepare('DELETE FROM suppliers').run()
    sqlite.prepare('DELETE FROM categories').run()
    sqlite.prepare('DELETE FROM settings').run()
    const now = toISO(new Date())
    const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
    const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
    // Old backups were written with camelCase Drizzle keys; new ones use
    // snake_case DB column names. Accept both so old files stay importable.
    const pick = (row: Record<string, unknown>, snake: string, camel: string): unknown =>
      row[snake] ?? row[camel]
    const pickNum = (row: Record<string, unknown>, snake: string, camel: string, fallback: number): number =>
      num(pick(row, snake, camel), fallback)
    const pickNumOrNull = (row: Record<string, unknown>, snake: string, camel: string): number | null => {
      const v = pick(row, snake, camel)
      return typeof v === 'number' && Number.isFinite(v) ? v : null
    }
    const pickStr = (row: Record<string, unknown>, snake: string, camel: string): string | null => str(pick(row, snake, camel))
    const pickStrFallback = (row: Record<string, unknown>, snake: string, camel: string, fallback: string): string => {
      const v = pick(row, snake, camel)
      return typeof v === 'string' ? v : fallback
    }
    for (const [key, value] of Object.entries(validatedSettings)) {
      sqlite.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), now)
    }
    const insertCat = sqlite.prepare('INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)')
    for (const c of parsed.categories) {
      insertCat.run(
        typeof c.id === 'number' ? c.id : null,
        typeof c.name === 'string' ? c.name : '',
        typeof c.description === 'string' ? c.description : null,
        typeof pick(c, 'created_at', 'createdAt') === 'string' ? (pick(c, 'created_at', 'createdAt') as string) : now
      )
    }
    const insertSup = sqlite.prepare(
      'INSERT INTO suppliers (id, company_name, contact_person, phone, email, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const s of parsed.suppliers) {
      insertSup.run(
        typeof s.id === 'number' ? s.id : null,
        typeof pick(s, 'company_name', 'companyName') === 'string' && (pick(s, 'company_name', 'companyName') as string).trim() !== ''
          ? (pick(s, 'company_name', 'companyName') as string)
          : '',
        pickStr(s, 'contact_person', 'contactPerson'),
        pickStr(s, 'phone', 'phone'),
        pickStr(s, 'email', 'email'),
        pickStr(s, 'address', 'address'),
        typeof pick(s, 'created_at', 'createdAt') === 'string' ? (pick(s, 'created_at', 'createdAt') as string) : now,
        typeof pick(s, 'updated_at', 'updatedAt') === 'string' ? (pick(s, 'updated_at', 'updatedAt') as string) : now
      )
    }
    const insertProd = sqlite.prepare(
      'INSERT INTO products (id, name, barcode, category_id, unit, selling_price, cost_price, stock_qty, min_stock, supplier_id, description, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const seenBarcodes = new Set<string>()
    for (const p of parsed.products) {
      const code = typeof p.barcode === 'string' ? p.barcode.trim() : ''
      if (code !== '') {
        if (seenBarcodes.has(code)) throw new Error(`Duplicate barcode ${code} in backup`)
        seenBarcodes.add(code)
      }
      insertProd.run(
        typeof p.id === 'number' ? p.id : null,
        typeof p.name === 'string' ? p.name : '',
        str(p.barcode),
        pickNumOrNull(p, 'category_id', 'categoryId'),
        typeof p.unit === 'string' ? p.unit : 'pcs',
        pickNum(p, 'selling_price', 'sellingPrice', 0),
        pickNum(p, 'cost_price', 'costPrice', 0),
        pickNum(p, 'stock_qty', 'stockQty', 0),
        pickNum(p, 'min_stock', 'minStock', 5),
        pickNumOrNull(p, 'supplier_id', 'supplierId'),
        pickStr(p, 'description', 'description'),
        pickStr(p, 'archived_at', 'archivedAt'),
        typeof pick(p, 'created_at', 'createdAt') === 'string' ? (pick(p, 'created_at', 'createdAt') as string) : now,
        typeof pick(p, 'updated_at', 'updatedAt') === 'string' ? (pick(p, 'updated_at', 'updatedAt') as string) : now
      )
    }
    const insertSale = sqlite.prepare(
      'INSERT INTO sales (id, receipt_no, created_at, subtotal, discount, total, payment_method, cash_amount, card_amount, change_amount, status, canceled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const s of parsed.sales) {
      const receiptNo = pick(s, 'receipt_no', 'receiptNo')
      const createdAt = pick(s, 'created_at', 'createdAt')
      const paymentMethod = pick(s, 'payment_method', 'paymentMethod')
      const canceledAt = pick(s, 'canceled_at', 'canceledAt')
      insertSale.run(
        typeof s.id === 'number' ? s.id : null,
        typeof receiptNo === 'string' ? receiptNo : `RESTORED-${String(s.id ?? '?')}`,
        typeof createdAt === 'string' ? createdAt : now,
        num(s.subtotal, 0),
        num(s.discount, 0),
        num(s.total, 0),
        typeof paymentMethod === 'string' ? paymentMethod : 'cash',
        pickNumOrNull(s, 'cash_amount', 'cashAmount'),
        pickNumOrNull(s, 'card_amount', 'cardAmount'),
        pickNum(s, 'change_amount', 'changeAmount', 0),
        typeof s.status === 'string' ? s.status : 'completed',
        str(canceledAt)
      )
    }
    const insertItem = sqlite.prepare(
      'INSERT INTO sale_items (id, sale_id, product_id, product_name, unit, qty, unit_price, unit_cost, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const i of parsed.sale_items) {
      insertItem.run(
        typeof i.id === 'number' ? i.id : null,
        pickNumOrNull(i, 'sale_id', 'saleId'),
        pickNumOrNull(i, 'product_id', 'productId'),
        pickStrFallback(i, 'product_name', 'productName', ''),
        typeof i.unit === 'string' ? i.unit : 'pcs',
        num(i.qty, 0),
        pickNum(i, 'unit_price', 'unitPrice', 0),
        pickNum(i, 'unit_cost', 'unitCost', 0),
        pickNum(i, 'line_total', 'lineTotal', 0)
      )
    }
    const insertExpCat = sqlite.prepare('INSERT INTO expense_categories (id, name, description, created_at) VALUES (?, ?, ?, ?)')
    for (const c of parsed.expense_categories) {
      insertExpCat.run(
        typeof c.id === 'number' ? c.id : null,
        typeof c.name === 'string' ? c.name : '',
        typeof c.description === 'string' ? c.description : null,
        typeof pick(c, 'created_at', 'createdAt') === 'string' ? (pick(c, 'created_at', 'createdAt') as string) : now
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
        pickNumOrNull(e, 'category_id', 'categoryId'),
        pickStrFallback(e, 'payment_method', 'paymentMethod', 'cash'),
        str(e.recipient),
        str(e.reference),
        str(e.notes),
        typeof pick(e, 'created_at', 'createdAt') === 'string' ? (pick(e, 'created_at', 'createdAt') as string) : now,
        typeof pick(e, 'updated_at', 'updatedAt') === 'string' ? (pick(e, 'updated_at', 'updatedAt') as string) : now
      )
    }
    const insertAdj = sqlite.prepare(
      'INSERT INTO stock_adjustments (id, product_id, qty_change, type, reason, cost_price, selling_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const a of parsed.stock_adjustments) {
      insertAdj.run(
        typeof a.id === 'number' ? a.id : null,
        pickNumOrNull(a, 'product_id', 'productId'),
        pickNum(a, 'qty_change', 'qtyChange', 0),
        typeof a.type === 'string' ? a.type : '',
        typeof a.reason === 'string' ? a.reason : '',
        pickNumOrNull(a, 'cost_price', 'costPrice'),
        pickNumOrNull(a, 'selling_price', 'sellingPrice'),
        typeof pick(a, 'created_at', 'createdAt') === 'string' ? (pick(a, 'created_at', 'createdAt') as string) : now
      )
    }
  })
  run()
  return { categories: parsed.categories.length, products: parsed.products.length }
}

/** Delete everything and reseed defaults. */
export function resetDatabase(): void {
  const sqlite = getSqlite()
  sqlite.prepare('DELETE FROM stock_adjustments').run()
  sqlite.prepare('DELETE FROM sale_items').run()
  sqlite.prepare('DELETE FROM sales').run()
  sqlite.prepare('DELETE FROM expenses').run()
  sqlite.prepare('DELETE FROM expense_categories').run()
  sqlite.prepare('DELETE FROM products').run()
  sqlite.prepare('DELETE FROM suppliers').run()
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
  const stamp = toISO(new Date()).replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return join(backupDir(), `inventory-${stamp}.xlsx`)
}

/** Close-backup target: custom folder setting, else app-managed default. Created on demand. */
export function backupDir(): string {
  const custom = getSettings().general.backupDir.trim()
  const dir = custom !== '' ? custom : join(app.getPath('userData'), 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Custom folder ('' = default) plus the resolved folder actually used. */
export interface BackupDirInfo {
  custom: string
  resolved: string
}

export function getBackupDirInfo(): BackupDirInfo {
  return { custom: getSettings().general.backupDir.trim(), resolved: backupDir() }
}

export function writeTextFile(filePath: string, text: string): void {
  writeFileSync(filePath, text, 'utf-8')
}

export function readTextFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}
