import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { round2 } from '../../shared/money'
import type {
  BasketPoint,
  CardFeeReport,
  CategoryProfitRow,
  DeadStockInput,
  DeadStockRow,
  DiscountSummary,
  ExpenseSummary,
  FinancialMetrics,
  InventoryOverview,
  InventoryValueRow,
  MonthPoint,
  PaymentRevenueRow,
  RangeInput,
  ReorderRow,
  SupplierRevenueRow,
  TopProductRow,
  TopProductsInput,
  TrendPoint,
  WeekdayPoint,
  YearInput
} from '../../shared/analytics'
import { getDb, type AppDb } from './client'
import { categories, expenseCategories, expenses, products, saleItems, sales, suppliers } from './schema'
import { readSettings } from './settingsStore'

const COMPLETED = eq(sales.status, 'completed')

function marginOf(profit: number, revenue: number): number {
  return revenue > 0 ? (profit / revenue) * 100 : 0
}

/** Â§8.1 â€” revenue, gross profit (snapshot costs), margin, expenses, cash math. */
export function getFinancialMetrics(input: RangeInput, db: AppDb = getDb()): FinancialMetrics {
  const { from, to } = input
  const rows = db
    .select({
      total: sales.total,
      discount: sales.discount,
      method: sales.paymentMethod,
      cashAmount: sales.cashAmount
    })
    .from(sales)
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .all()
  const revenue = round2(rows.reduce((s, r) => s + r.total, 0))
  const cogs = round2(
    db
      .select({ c: sql<number>`COALESCE(SUM(${saleItems.qty} * ${saleItems.unitCost}), 0)` })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
      .get()?.c ?? 0
  )
  const profit = round2(revenue - cogs)
  const expenseSummary = getExpenseSummary(input, db)
  const cashRevenue = round2(
    rows.reduce((s, r) => s + (r.method === 'cash' ? r.total : 0) + (r.method === 'split' ? (r.cashAmount ?? 0) : 0), 0)
  )
  return {
    revenue,
    profit,
    margin: marginOf(profit, revenue),
    expenses: expenseSummary.total,
    cashRevenue,
    totalCash: round2(cashRevenue - expenseSummary.total),
    revenueExpenseDiff: round2(revenue - expenseSummary.total)
  }
}

/** Â§8.2 â€” top products with overall-margin-compatible rows. */
export function getTopProducts(input: TopProductsInput, db: AppDb = getDb()): TopProductRow[] {
  const { from, to, sort, limit } = input
  const rows = db
    .select({
      productId: saleItems.productId,
      name: saleItems.productName,
      qty: sql<number>`SUM(${saleItems.qty})`,
      revenue: sql<number>`SUM(${saleItems.lineTotal})`,
      cost: sql<number>`SUM(${saleItems.qty} * ${saleItems.unitCost})`
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .groupBy(saleItems.productId, saleItems.productName)
    .all()
  const mapped = rows.map((r) => {
    const revenue = round2(r.revenue)
    const profit = round2(revenue - r.cost)
    return {
      productId: r.productId,
      name: r.name,
      quantity: r.qty,
      revenue,
      profit,
      margin: marginOf(profit, revenue)
    }
  })
  const key = sort === 'quantity' ? 'quantity' : sort
  mapped.sort((a, b) => b[key] - a[key])
  return mapped.slice(0, limit)
}

/** Â§8.4 â€” per-supplier revenue/profit. Discounts excluded (spec warning). */
export function getSupplierRevenue(input: RangeInput, db: AppDb = getDb()): SupplierRevenueRow[] {
  const { from, to } = input
  const rows = db
    .select({
      supplierId: products.supplierId,
      supplierName: suppliers.companyName,
      revenue: sql<number>`COALESCE(SUM(${saleItems.lineTotal}), 0)`,
      cost: sql<number>`COALESCE(SUM(${saleItems.qty} * ${saleItems.unitCost}), 0)`
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .groupBy(products.supplierId, suppliers.companyName)
    .all()
  return rows
    .map((r) => {
      const revenue = round2(r.revenue)
      const profit = round2(revenue - r.cost)
      return { supplierId: r.supplierId, name: r.supplierName ?? '', revenue, profit, margin: marginOf(profit, revenue) }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

/** Â§8.3 â€” revenue share per payment method. */
export function getPaymentRevenue(input: RangeInput, db: AppDb = getDb()): PaymentRevenueRow[] {
  const { from, to } = input
  const rows = db
    .select({ method: sales.paymentMethod, revenue: sql<number>`SUM(${sales.total})` })
    .from(sales)
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .groupBy(sales.paymentMethod)
    .all()
  const total = rows.reduce((s, r) => s + r.revenue, 0)
  return rows
    .map((r) => ({ method: r.method, revenue: round2(r.revenue), share: total > 0 ? (r.revenue / total) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

/** Card revenue (card + split card leg), fee and net from Settings. */
export function getCardFeeReport(input: RangeInput, db: AppDb = getDb()): CardFeeReport {
  const { from, to } = input
  const feePercent = readSettings(db).general.cardFeePercent
  const perDay = db
    .select({
      day: sql<string>`substr(${sales.createdAt}, 1, 10)`,
      card: sql<number>`COALESCE(SUM(CASE WHEN ${sales.paymentMethod} = 'card' THEN ${sales.total} ELSE 0 END), 0)`,
      splitCard: sql<number>`COALESCE(SUM(CASE WHEN ${sales.paymentMethod} = 'split' THEN ${sales.cardAmount} ELSE 0 END), 0)`
    })
    .from(sales)
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .groupBy(sql`substr(${sales.createdAt}, 1, 10)`)
    .orderBy(sql`substr(${sales.createdAt}, 1, 10)`)
    .all()
    .map((r) => {
      const cardRevenue = round2(r.card + r.splitCard)
      return { day: r.day, cardRevenue, feeAmount: round2((cardRevenue * feePercent) / 100) }
    })
  const cardRevenue = round2(perDay.reduce((s, d) => s + d.cardRevenue, 0))
  const feeAmount = round2((cardRevenue * feePercent) / 100)
  return {
    cardRevenue,
    feePercent,
    feeAmount,
    netCard: round2(cardRevenue - feeAmount),
    perDay: perDay.filter((d) => d.cardRevenue > 0)
  }
}

/** Â§8.5 â€” per-category revenue/cost/profit. Discounts excluded (spec warning). */
export function getCategoryProfit(input: RangeInput, db: AppDb = getDb()): CategoryProfitRow[] {
  const { from, to } = input
  const rows = db
    .select({
      categoryId: products.categoryId,
      categoryName: categories.name,
      revenue: sql<number>`COALESCE(SUM(${saleItems.lineTotal}), 0)`,
      cost: sql<number>`COALESCE(SUM(${saleItems.qty} * ${saleItems.unitCost}), 0)`
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .groupBy(products.categoryId, categories.name)
    .all()
  return rows
    .map((r) => {
      const revenue = round2(r.revenue)
      const cost = round2(r.cost)
      const profit = round2(revenue - cost)
      return {
        categoryId: r.categoryId,
        name: r.categoryName ?? '',
        revenue,
        cost,
        profit,
        margin: marginOf(profit, revenue)
      }
    })
    .sort((a, b) => b.profit - a.profit)
}

/** Expense total + per-category breakdown for a range. */
export function getExpenseSummary(input: RangeInput, db: AppDb = getDb()): ExpenseSummary {
  const { from, to } = input
  const rows = db
    .select({
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      total: sql<number>`SUM(${expenses.amount})`
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(and(gte(expenses.date, from), lte(expenses.date, to)))
    .groupBy(expenses.categoryId, expenseCategories.name)
    .all()
  const byCategory = rows
    .map((r) => ({ categoryId: r.categoryId, name: r.categoryName ?? '', total: round2(r.total) }))
    .sort((a, b) => b.total - a.total)
  return { total: round2(byCategory.reduce((s, c) => s + c.total, 0)), byCategory }
}

/** Days of cover from trailing-30d sales. Null cover sorts last (never sold). */
export function getReorderSuggestions(db: AppDb = getDb()): ReorderRow[] {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  const sold = db
    .select({
      productId: saleItems.productId,
      qty: sql<number>`COALESCE(SUM(${saleItems.qty}), 0)`
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.createdAt, cutoff), COMPLETED))
    .groupBy(saleItems.productId)
    .all()
  const daily = new Map<number, number>()
  for (const s of sold) {
    if (s.productId !== null) daily.set(s.productId, s.qty / 30)
  }
  return db
    .select()
    .from(products)
    .where(isNull(products.archivedAt))
    .orderBy(products.name)
    .all()
    .map((p) => {
      const avg = daily.get(p.id) ?? 0
      return {
        productId: p.id,
        name: p.name,
        stockQty: p.stockQty,
        unit: p.unit,
        minStock: p.minStock,
        avgDailySales: avg,
        daysOfCover: avg > 0 ? p.stockQty / avg : null
      }
    })
    .sort((a, b) => (a.daysOfCover ?? Number.POSITIVE_INFINITY) - (b.daysOfCover ?? Number.POSITIVE_INFINITY))
}

/** Stocked products with no completed sale since the cutoff. */
export function getDeadStock(input: DeadStockInput, db: AppDb = getDb()): { items: DeadStockRow[]; totalValue: number } {
  const cutoff = new Date(Date.now() - input.days * 86400000).toISOString()
  const lastSold = db
    .select({
      productId: saleItems.productId,
      at: sql<string>`MAX(${sales.createdAt})`
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(COMPLETED)
    .groupBy(saleItems.productId)
    .all()
  const lastByProduct = new Map<number, string>()
  for (const r of lastSold) {
    if (r.productId !== null && r.at !== null) lastByProduct.set(r.productId, r.at)
  }
  const items = db
    .select()
    .from(products)
    .where(isNull(products.archivedAt))
    .orderBy(products.name)
    .all()
    .filter((p) => {
      if (p.stockQty <= 0) return false
      const at = lastByProduct.get(p.id)
      return !at || at < cutoff
    })
    .map((p) => ({
      productId: p.id,
      name: p.name,
      stockQty: p.stockQty,
      unit: p.unit,
      tiedValue: round2(p.stockQty * p.costPrice),
      lastSoldAt: lastByProduct.get(p.id) ?? null
    }))
    .sort((a, b) => b.tiedValue - a.tiedValue)
  return { items, totalValue: round2(items.reduce((s, i) => s + i.tiedValue, 0)) }
}

/** Daily basket: sales, items, revenue and averages. */
export function getBasketTrend(input: RangeInput, db: AppDb = getDb()): BasketPoint[] {
  const { from, to } = input
  const dayExpr = sql<string>`substr(${sales.createdAt}, 1, 10)`
  const head = db
    .select({
      day: dayExpr,
      sales: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(${sales.total}), 0)`
    })
    .from(sales)
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .groupBy(dayExpr)
    .orderBy(dayExpr)
    .all()
  const itemRows = db
    .select({ day: dayExpr, items: sql<number>`COALESCE(SUM(${saleItems.qty}), 0)` })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .groupBy(dayExpr)
    .all()
  const itemsByDay = new Map(itemRows.map((r) => [r.day, r.items]))
  return head.map((r) => {
    const items = itemsByDay.get(r.day) ?? 0
    return {
      day: r.day,
      sales: r.sales,
      items,
      revenue: round2(r.revenue),
      avgItems: r.sales > 0 ? items / r.sales : 0,
      avgValue: r.sales > 0 ? round2(r.revenue / r.sales) : 0
    }
  })
}

/** Discount given: totals plus a daily series. Line-level attribution is impossible (sale-level discounts). */
export function getDiscountSummary(input: RangeInput, db: AppDb = getDb()): DiscountSummary {
  const { from, to } = input
  const rows = db
    .select({
      day: sql<string>`substr(${sales.createdAt}, 1, 10)`,
      gross: sql<number>`COALESCE(SUM(${sales.subtotal}), 0)`,
      discount: sql<number>`COALESCE(SUM(${sales.discount}), 0)`,
      discounted: sql<number>`COALESCE(SUM(CASE WHEN ${sales.discount} > 0 THEN 1 ELSE 0 END), 0)`
    })
    .from(sales)
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .groupBy(sql`substr(${sales.createdAt}, 1, 10)`)
    .orderBy(sql`substr(${sales.createdAt}, 1, 10)`)
    .all()
  const gross = round2(rows.reduce((s, r) => s + r.gross, 0))
  const discount = round2(rows.reduce((s, r) => s + r.discount, 0))
  return {
    gross,
    discount,
    share: gross > 0 ? (discount / gross) * 100 : 0,
    discountedSales: rows.reduce((s, r) => s + r.discounted, 0),
    perDay: rows.map((r) => ({ day: r.day, discount: round2(r.discount) }))
  }
}

/** Monthly expense bars for the trend panel (fixed window ending now). */
export function getMonthlyExpenses(months: number, db: AppDb = getDb()): Array<{ month: string; total: number }> {
  const now = new Date()
  const out: Array<{ month: string; total: number }> = []
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const total =
      db
        .select({ t: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
        .from(expenses)
        .where(and(gte(expenses.date, start.toISOString()), lte(expenses.date, end.toISOString())))
        .get()?.t ?? 0
    out.push({ month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`, total: round2(total) })
  }
  return out
}

// --- Dashboard snapshots, trends and averages (Â§2) ---

/** Â§2.1 cards beyond FinancialMetrics. Today = local midnight boundary. */
export function getInventoryOverview(db: AppDb = getDb()): InventoryOverview {
  const active = db.select().from(products).where(isNull(products.archivedAt)).all()
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const todaySales =
    db
      .select({ t: sql<number>`COALESCE(SUM(${sales.total}), 0)` })
      .from(sales)
      .where(and(gte(sales.createdAt, midnight.toISOString()), COMPLETED))
      .get()?.t ?? 0
  const inventoryValue = round2(active.reduce((s, p) => s + p.stockQty * p.costPrice, 0))
  const monthStart = new Date(midnight.getFullYear(), midnight.getMonth(), 1).toISOString()
  const monthCogs =
    db
      .select({ c: sql<number>`COALESCE(SUM(${saleItems.qty} * ${saleItems.unitCost}), 0)` })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(gte(sales.createdAt, monthStart), COMPLETED))
      .get()?.c ?? 0
  return {
    totalProducts: active.length,
    lowStockItems: active.filter((p) => p.stockQty <= p.minStock).length,
    todaySales: round2(todaySales),
    inventoryValue,
    // True turnover needs average inventory over time; current value is the
    // documented small-shop approximation (no historical snapshots exist).
    turnover: inventoryValue > 0 ? monthCogs / inventoryValue : 0
  }
}

/** Current stock value grouped by supplier or category (Â§2.7, Â§2.11). */
export function getInventoryValue(
  by: 'supplier' | 'category',
  db: AppDb = getDb()
): InventoryValueRow[] {
  const rows = db.select().from(products).where(isNull(products.archivedAt)).all()
  const supNames = new Map(db.select().from(suppliers).all().map((s) => [s.id, s.companyName]))
  const catNames = new Map(db.select().from(categories).all().map((c) => [c.id, c.name]))
  const groups = new Map<string, { name: string; value: number; items: number }>()
  for (const p of rows) {
    const id = by === 'supplier' ? p.supplierId : p.categoryId
    const key = id === null ? '' : String(id)
    const names = by === 'supplier' ? supNames : catNames
    const entry = groups.get(key) ?? { name: names.get(id as number) ?? '', value: 0, items: 0 }
    entry.value = round2(entry.value + p.stockQty * p.costPrice)
    entry.items += 1
    groups.set(key, entry)
  }
  const total = [...groups.values()].reduce((s, g) => s + g.value, 0)
  return [...groups.entries()]
    .map(([key, g]) => ({ key, name: g.name, value: g.value, items: g.items, share: total > 0 ? (g.value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)
}

/** Six calendar months of revenue + gross profit (Â§2.9). */
export function getRevenueProfitTrend(months: number, db: AppDb = getDb()): TrendPoint[] {
  const now = new Date()
  const out: TrendPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const from = start.toISOString()
    const to = end.toISOString()
    const revenue =
      db
        .select({ t: sql<number>`COALESCE(SUM(${sales.total}), 0)` })
        .from(sales)
        .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
        .get()?.t ?? 0
    const cogs =
      db
        .select({ c: sql<number>`COALESCE(SUM(${saleItems.qty} * ${saleItems.unitCost}), 0)` })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
        .get()?.c ?? 0
    out.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      revenue: round2(revenue),
      profit: round2(revenue - cogs)
    })
  }
  return out
}

/** Per-weekday average sale count + revenue over the range (Â§2.4). Monday-first. */
export function getWeekdayAverages(input: RangeInput, db: AppDb = getDb()): WeekdayPoint[] {
  const { from, to } = input
  const rows = db
    .select({ createdAt: sales.createdAt, total: sales.total })
    .from(sales)
    .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to), COMPLETED))
    .all()
  // Monday=0..Sunday=6 buckets plus occurrence counts in the window.
  const salesByDay: number[][] = Array.from({ length: 7 }, () => [])
  const occurrences = [0, 0, 0, 0, 0, 0, 0] as number[]
  for (let d = new Date(from.slice(0, 10)); d <= new Date(to.slice(0, 10)); d.setDate(d.getDate() + 1)) {
    occurrences[(d.getDay() + 6) % 7] = (occurrences[(d.getDay() + 6) % 7] as number) + 1
  }
  for (const r of rows) {
    const weekday = (new Date(r.createdAt).getDay() + 6) % 7
    ;(salesByDay[weekday] as number[]).push(r.total)
  }
  return salesByDay.map((totals, weekday) => {
    const n = totals.length
    const revenue = round2(totals.reduce((s, v) => s + v, 0))
    const occ = occurrences[weekday] as number
    return {
      weekday,
      sales: n,
      revenue,
      avgSales: occ > 0 ? n / occ : 0,
      avgRevenue: occ > 0 ? round2(revenue / occ) : 0
    }
  })
}

/** Per-month average sale count + revenue for a calendar year (Â§2.5). */
export function getMonthlyAverages(
  input: YearInput,
  db: AppDb = getDb()
): MonthPoint[] {
  const { year } = input
  const rows = db
    .select({ createdAt: sales.createdAt, total: sales.total })
    .from(sales)
    .where(
      and(gte(sales.createdAt, `${year}-01-01T00:00:00.000Z`), lte(sales.createdAt, `${year}-12-31T23:59:59.999Z`), COMPLETED)
    )
    .all()
  const byMonth: number[][] = Array.from({ length: 12 }, () => [])
  for (const r of rows) {
    const m = new Date(r.createdAt).getMonth()
    ;(byMonth[m] as number[]).push(r.total)
  }
  return byMonth.map((totals, month) => {
    const revenue = round2(totals.reduce((s, v) => s + v, 0))
    return { month, sales: totals.length, revenue, avgSales: totals.length, avgRevenue: revenue }
  })
}
