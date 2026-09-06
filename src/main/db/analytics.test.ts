import { beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import type { AppDb } from './client'
import {
  getBasketTrend,
  getCardFeeReport,
  getCategoryProfit,
  getDeadStock,
  getDiscountSummary,
  getExpenseSummary,
  getFinancialMetrics,
  getPaymentRevenue,
  getReorderSuggestions,
  getSupplierRevenue,
  getTopProducts
} from './analytics'

let db: AppDb
let sqlite: Database.Database

const RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.999Z' }

beforeAll(() => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') })

  // Sale/expense timestamps use real now so trailing-30d windows hit them.
  const now = new Date().toISOString()
  db.insert(schema.settings).values({ key: 'general', value: JSON.stringify({ cardFeePercent: 1 }), updatedAt: now }).run()
  const catId = db.insert(schema.categories).values({ name: 'Drinks', description: null, createdAt: now }).run()
    .lastInsertRowid as number
  const supId = db
    .insert(schema.suppliers)
    .values({ companyName: 'Acme', contactPerson: null, phone: null, email: null, address: null, createdAt: now, updatedAt: now })
    .run().lastInsertRowid as number
  const prodId = db
    .insert(schema.products)
    .values({
      name: 'Cola',
      barcode: null,
      categoryId: catId,
      unit: 'pcs',
      sellingPrice: 25,
      costPrice: 10,
      stockQty: 8,
      minStock: 5,
      supplierId: supId,
      description: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    })
    .run().lastInsertRowid as number
  const staleId = db
    .insert(schema.products)
    .values({
      name: 'Stale Tea',
      barcode: null,
      categoryId: catId,
      unit: 'pcs',
      sellingPrice: 10,
      costPrice: 4,
      stockQty: 20,
      minStock: 5,
      supplierId: null,
      description: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    })
    .run().lastInsertRowid as number
  void staleId
  const saleId = db
    .insert(schema.sales)
    .values({
      receiptNo: 'INV-1',
      createdAt: now,
      subtotal: 50,
      discount: 5,
      total: 45,
      paymentMethod: 'cash',
      cashAmount: 50,
      cardAmount: null,
      changeAmount: 5,
      status: 'completed',
      canceledAt: null
    })
    .run().lastInsertRowid as number
  db.insert(schema.saleItems)
    .values({ saleId, productId: prodId, productName: 'Cola', unit: 'pcs', qty: 2, unitPrice: 25, unitCost: 10, lineTotal: 50 })
    .run()
  // Canceled sale must not leak into metrics.
  const canceledId = db
    .insert(schema.sales)
    .values({
      receiptNo: 'INV-2',
      createdAt: now,
      subtotal: 1000,
      discount: 0,
      total: 1000,
      paymentMethod: 'card',
      cashAmount: null,
      cardAmount: 1000,
      changeAmount: 0,
      status: 'canceled',
      canceledAt: now
    })
    .run().lastInsertRowid as number
  db.insert(schema.saleItems)
    .values({ saleId: canceledId, productId: prodId, productName: 'Cola', unit: 'pcs', qty: 40, unitPrice: 25, unitCost: 10, lineTotal: 1000 })
    .run()
  db.insert(schema.expenses)
    .values({
      date: now,
      amount: 20,
      description: 'Rent',
      categoryId: null,
      paymentMethod: 'cash',
      recipient: null,
      reference: null,
      notes: null,
      createdAt: now,
      updatedAt: now
    })
    .run()
})

describe('analytics', () => {
  it('computes financial metrics excluding canceled sales', () => {
    const m = getFinancialMetrics(RANGE, db)
    expect(m.revenue).toBe(45)
    expect(m.profit).toBe(25)
    expect(m.margin).toBeCloseTo(55.55, 1)
    expect(m.expenses).toBe(20)
    expect(m.cashRevenue).toBe(45)
    expect(m.totalCash).toBe(25)
    expect(m.revenueExpenseDiff).toBe(25)
  })

  it('ranks top products', () => {
    const rows = getTopProducts({ ...RANGE, sort: 'revenue', limit: 10 }, db)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Cola', quantity: 2, revenue: 50, profit: 30 })
  })

  it('breaks down supplier, payment, category and expenses', () => {
    const sup = getSupplierRevenue(RANGE, db)
    expect(sup).toHaveLength(1)
    expect(sup[0]).toMatchObject({ name: 'Acme', revenue: 50, profit: 30 })
    const pay = getPaymentRevenue(RANGE, db)
    expect(pay).toEqual([{ method: 'cash', revenue: 45, share: 100 }])
    const cat = getCategoryProfit(RANGE, db)
    expect(cat).toHaveLength(1)
    expect(cat[0]).toMatchObject({ name: 'Drinks', revenue: 50, cost: 20, profit: 30 })
    const exp = getExpenseSummary(RANGE, db)
    expect(exp.total).toBe(20)
  })

  it('computes card fees from settings', () => {
    const fees = getCardFeeReport(RANGE, db)
    expect(fees.cardRevenue).toBe(0)
    expect(fees.feePercent).toBe(1)
    expect(fees.perDay).toEqual([])
  })

  it('flags never-sold stocked products as dead stock', () => {
    // June-2026 sale is within 365d of real now; Stale Tea never sold.
    const { items, totalValue } = getDeadStock({ days: 365 }, db)
    expect(items.map((i) => i.name)).toEqual(['Stale Tea'])
    expect(totalValue).toBe(80)
    expect(items[0]?.lastSoldAt).toBeNull()
  })

  it('tracks baskets and discounts daily', () => {
    const basket = getBasketTrend(RANGE, db)
    expect(basket).toHaveLength(1)
    expect(basket[0]).toMatchObject({ sales: 1, items: 2, revenue: 45, avgItems: 2, avgValue: 45 })
    const disc = getDiscountSummary(RANGE, db)
    expect(disc).toMatchObject({ gross: 50, discount: 5, discountedSales: 1 })
  })

  it('computes days of cover for reorder', () => {
    const rows = getReorderSuggestions(db)
    const cola = rows.find((r) => r.name === 'Cola')
    expect(cola?.avgDailySales).toBeGreaterThan(0)
    expect(cola?.daysOfCover).not.toBeNull()
    const stale = rows.find((r) => r.name === 'Stale Tea')
    // Sold nothing in trailing 30d → null cover, sorts last.
    expect(stale?.daysOfCover).toBeNull()
    expect(rows[rows.length - 1]?.name).toBe('Stale Tea')
  })
})
