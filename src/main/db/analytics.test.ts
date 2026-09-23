import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import type { AppDb } from './client'
import {
  getAffinityPairs,
  getBasketTrend,
  getCardFeeReport,
  getCategoryProfit,
  getDeadStock,
  getDiscountSummary,
  getExpenseSummary,
  getFinancialMetrics,
  getHourlySales,
  getInventoryOverview,
  getInventoryValue,
  getLowMarginProducts,
  getMonthlyAverages,
  getPaymentRevenue,
  getReorderSuggestions,
  getRevenueProfitTrend,
  getSupplierRevenue,
  getTopProducts,
  getWeekdayAverages
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

  it('computes the inventory overview', () => {
    const o = getInventoryOverview(db)
    expect(o.totalProducts).toBe(2)
    expect(o.lowStockItems).toBe(0)
    expect(o.todaySales).toBe(45)
    expect(o.inventoryValue).toBe(160)
    expect(o.turnover).toBeCloseTo(20 / 160, 10)
    expect(o.monthCogs).toBe(20)
  })

  it('groups inventory value by supplier and category', () => {
    const bySup = getInventoryValue('supplier', db)
    expect(bySup.reduce((s, r) => s + r.value, 0)).toBe(160)
    expect(bySup.find((r) => r.name === 'Acme')?.value).toBe(80)
    const byCat = getInventoryValue('category', db)
    expect(byCat).toHaveLength(1)
    expect(byCat[0]).toMatchObject({ name: 'Drinks', value: 160, items: 2, share: 100 })
  })

  it('tracks revenue and profit per month', () => {
    const trend = getRevenueProfitTrend(1, db)
    expect(trend).toHaveLength(1)
    expect(trend[0]?.revenue).toBe(45)
    expect(trend[0]?.profit).toBe(25)
  })

  it('averages sales by weekday and month', () => {
    const week = getWeekdayAverages(RANGE, db)
    expect(week).toHaveLength(7)
    expect(week.reduce((s, d) => s + d.sales, 0)).toBe(1)
    expect(week.reduce((s, d) => s + d.revenue, 0)).toBe(45)
    const months = getMonthlyAverages({ year: new Date().getFullYear() }, db)
    expect(months).toHaveLength(12)
    expect(months.reduce((s, m) => s + m.sales, 0)).toBe(1)
  })
})

/** Isolated fixture for the three new aggregations (keeps the suite above intact). */
describe('hourly, affinity and low-margin', () => {
  let db2: AppDb
  let sqlite2: Database.Database
  const H_RANGE = { from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T23:59:59.999Z' }

  beforeAll(() => {
    sqlite2 = new Database(':memory:')
    db2 = drizzle(sqlite2, { schema })
    migrate(db2, { migrationsFolder: join(process.cwd(), 'drizzle') })
    const now = '2026-06-15T12:00:00.000Z'

    const mkProduct = (name: string): number =>
      db2
        .insert(schema.products)
        .values({
          name,
          barcode: null,
          categoryId: null,
          unit: 'pcs',
          sellingPrice: 100,
          costPrice: 10,
          stockQty: 50,
          minStock: 5,
          supplierId: null,
          description: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now
        })
        .run().lastInsertRowid as number

    const mkSale = (createdAt: string, subtotal: number, discount: number, total: number): number =>
      db2
        .insert(schema.sales)
        .values({
          receiptNo: `HX-${createdAt}`,
          createdAt,
          subtotal,
          discount,
          total,
          paymentMethod: 'cash',
          cashAmount: total,
          cardAmount: null,
          changeAmount: 0,
          status: 'completed',
          canceledAt: null
        })
        .run().lastInsertRowid as number

    const mkItem = (saleId: number, productId: number, name: string, qty: number, price: number, cost: number): void => {
      db2
        .insert(schema.saleItems)
        .values({ saleId, productId, productName: name, unit: 'pcs', qty, unitPrice: price, unitCost: cost, lineTotal: qty * price })
        .run()
    }

    // Hourly: two morning sales, one evening sale.
    const h1 = mkSale('2026-06-10T08:15:00.000Z', 100, 0, 100)
    const h2 = mkSale('2026-06-11T08:45:00.000Z', 50, 0, 50)
    const h3 = mkSale('2026-06-12T20:05:00.000Z', 200, 0, 200)
    // Affinity + margin items on the same sales.
    const bread = mkProduct('Bread')
    const butter = mkProduct('Butter')
    const milk = mkProduct('Milk')
    mkItem(h1, bread, 'Bread', 1, 100, 90) // thin margin, worsened by discount below
    mkItem(h1, butter, 'Butter', 1, 100, 10)
    mkItem(h2, bread, 'Bread', 1, 50, 45)
    mkItem(h2, butter, 'Butter', 1, 50, 5)
    mkItem(h3, milk, 'Milk', 2, 100, 10) // rich margin, never flagged
    // Discounted sale: Bread goes negative after proration.
    const h4 = mkSale('2026-06-13T09:00:00.000Z', 100, 40, 60)
    mkItem(h4, bread, 'Bread', 1, 100, 90)
    void milk
  })

  afterAll(() => {
    sqlite2.close()
  })

  it('buckets sales into 24 local-hour rows', () => {
    const rows = getHourlySales(H_RANGE, db2)
    expect(rows).toHaveLength(24)
    const totalSales = rows.reduce((s, r) => s + r.sales, 0)
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
    expect(totalSales).toBe(4)
    expect(totalRevenue).toBe(410)
    const morningHour = new Date('2026-06-10T08:15:00.000Z').getHours()
    expect(rows[morningHour]?.sales).toBe(2)
  })

  it('finds the Bread+Butter pair with support over all sales', () => {
    const pairs = getAffinityPairs({ ...H_RANGE, limit: 10 }, db2)
    const bb = pairs.find(
      (p) => (p.aName === 'Bread' && p.bName === 'Butter') || (p.aName === 'Butter' && p.bName === 'Bread')
    )
    expect(bb?.together).toBe(2)
    expect(bb?.support).toBeCloseTo(50, 5)
    expect(pairs[0]).toEqual(bb)
  })

  it('flags negative-margin Bread but not rich-margin Milk', () => {    const rows = getLowMarginProducts({ ...H_RANGE, threshold: 20, limit: 20 }, db2)
    const names = rows.map((r) => r.name)
    expect(names).toContain('Bread')
    expect(names).not.toContain('Milk')
    const bread = rows.find((r) => r.name === 'Bread')
    // Gross 250, discount 40 prorated fully onto Bread's 100-line, cost 225.
    expect(bread).toMatchObject({ grossRevenue: 250, discount: 40, netRevenue: 210, cost: 225 })
    expect(bread?.profit).toBeLessThan(0)
    // Threshold is exclusive: threshold 0 keeps only loss-makers (Bread).
    expect(getLowMarginProducts({ ...H_RANGE, threshold: 0, limit: 20 }, db2).map((r) => r.name)).toEqual(['Bread'])
  })

  it('returns empty-shaped results outside any sales', () => {
    const empty = { from: '2020-01-01T00:00:00.000Z', to: '2020-01-31T23:59:59.999Z' }
    const hours = getHourlySales(empty, db2)
    expect(hours).toHaveLength(24)
    expect(hours.every((h) => h.sales === 0 && h.revenue === 0)).toBe(true)
    expect(getAffinityPairs({ ...empty, limit: 10 }, db2)).toEqual([])
    expect(getLowMarginProducts({ ...empty, threshold: 20, limit: 20 }, db2)).toEqual([])
  })
})

afterAll(() => {
  sqlite.close()
})
