import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from './schema'
import type { AppDb, DbHandles } from './client'
import { adjustStock, getPriceHistory } from './stock'
import { cancelSale, completeSale } from './sales'

let db: AppDb
let sqlite: Database.Database
let handles: DbHandles
let productId = 0

const now = () => new Date().toISOString()

beforeAll(() => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') })
  handles = { db, sqlite }
  db.insert(schema.settings)
    .values({ key: 'general', value: JSON.stringify({ lowStockNotifications: false }), updatedAt: now() })
    .run()
  productId = db
    .insert(schema.products)
    .values({
      name: 'Logged Widget',
      barcode: null,
      categoryId: null,
      unit: 'pcs',
      sellingPrice: 20,
      costPrice: 8,
      stockQty: 10,
      minStock: 5,
      supplierId: null,
      description: null,
      archivedAt: null,
      createdAt: now(),
      updatedAt: now()
    })
    .run().lastInsertRowid as number
})

const logRows = () =>
  db.select().from(schema.stockAdjustments).orderBy(schema.stockAdjustments.id).all()

describe('stock movement log', () => {
  it('logs adjustments with the default reason when empty', () => {
    const result = adjustStock({ productId, type: 'add', quantity: 5, newCostPrice: 8, newSellingPrice: null, reason: '' }, handles)
    expect(result.reason).toBe('Stock adjustment')
    expect(result.product.stockQty).toBe(15)
    const rows = logRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ productId, qtyChange: 5, type: 'add', reason: 'Stock adjustment' })
  })

  it('logs removals as negative changes', () => {
    adjustStock({ productId, type: 'remove', quantity: 3, newCostPrice: null, newSellingPrice: null, reason: 'Damaged' }, handles)
    const rows = logRows()
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ qtyChange: -3, type: 'remove', reason: 'Damaged' })
  })

  it('records prices on every movement for the history chart', () => {
    const history = getPriceHistory(productId, db)
    expect(history.length).toBeGreaterThanOrEqual(2)
    for (const point of history) {
      expect(typeof point.createdAt).toBe('string')
      expect(point.costPrice).not.toBeNull()
      expect(point.sellingPrice).not.toBeNull()
    }
    const ordered = history.map((h) => h.createdAt)
    expect([...ordered].sort()).toEqual(ordered)
  })

  it('logs each sale line with the receipt reference', () => {
    const receipt = completeSale(
      {
        lines: [{ productId, qty: 2 }],
        discount: { type: 'fixed', value: 0 },
        paymentMethod: 'cash',
        cashAmount: 40,
        cardAmount: null
      },
      handles
    )
    const rows = logRows().filter((r) => r.type === 'sale')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ productId, qtyChange: -2, reason: `Sale ${receipt.receiptNo}` })
    const stock = db.select().from(schema.products).where(eq(schema.products.id, productId)).get()?.stockQty
    expect(stock).toBe(10)
  })

  it('logs cancellation restores and puts stock back', () => {
    const receipt = completeSale(
      {
        lines: [{ productId, qty: 1 }],
        discount: { type: 'fixed', value: 0 },
        paymentMethod: 'cash',
        cashAmount: 20,
        cardAmount: null
      },
      handles
    )
    const saleId = db.select().from(schema.sales).where(eq(schema.sales.receiptNo, receipt.receiptNo)).get()?.id as number
    cancelSale(saleId, handles)
    const rows = logRows().filter((r) => r.type === 'restore')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ productId, qtyChange: 1, reason: `Cancel ${receipt.receiptNo}` })
    const stock = db.select().from(schema.products).where(eq(schema.products.id, productId)).get()?.stockQty
    expect(stock).toBe(10)
  })
})

afterAll(() => {
  sqlite.close()
})
