import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { cartSubtotal, checkoutInput, computeChange, computeDiscount, receiptNo, type CheckoutInput, type LowStockAlert, type Receipt } from '../../shared/sale'
import { SALE_PAGE_SIZE, saleId, saleListFilter, type SaleDetail, type SaleList } from '../../shared/sales'
import { round2 } from '../../shared/money'
import { stockStatus } from '../../shared/products'
import { toISO } from '../../shared/dates'
import { getDb, getSqlite } from './client'
import { products, saleItems, sales } from './schema'
import { getSettings } from './settingsStore'

/**
 * Validate stock, compute totals with shared discount rules, then insert the
 * sale + items and decrement stock in ONE transaction (features §3.5–§3.10).
 * Shortfall-as-discount and split math are resolved by the UI before calling.
 */
export function completeSale(input: CheckoutInput): Receipt {
  const parsed = checkoutInput.parse(input)
  const db = getDb()

  const items = parsed.lines.map((line) => {
    const product = db.select().from(products).where(eq(products.id, line.productId)).get()
    if (!product || product.archivedAt) throw new Error('Product not found')
    if (product.stockQty <= 0) throw new Error(`${product.name}: out of stock`)
    if (line.qty > product.stockQty) throw new Error(`${product.name}: insufficient stock`)
    return { product, qty: line.qty }
  })

  const subtotal = round2(cartSubtotal(items.map((i) => ({ qty: i.qty, unitPrice: i.product.sellingPrice }))))
  const discount = round2(computeDiscount(subtotal, parsed.discount))
  const total = round2(subtotal - discount)

  let cashAmount: number | null = null
  let cardAmount: number | null = null
  let changeAmount = 0
  if (parsed.paymentMethod === 'cash') {
    const cash = parsed.cashAmount ?? total
    if (round2(cash) < total) throw new Error('Cash amount is less than total')
    cashAmount = round2(cash)
    changeAmount = round2(computeChange(cashAmount, total))
  } else if (parsed.paymentMethod === 'card') {
    cardAmount = total
  } else {
    const cash = parsed.cashAmount ?? 0
    const card = parsed.cardAmount ?? 0
    if (round2(cash + card) < total) throw new Error('Combined payment is less than total')
    cashAmount = round2(cash)
    cardAmount = round2(card)
    changeAmount = round2(computeChange(cashAmount, total))
  }

  const now = new Date()
  const createdAt = toISO(now)
  const notifyLow = getSettings().general.lowStockNotifications
  const lowStock: LowStockAlert[] = []
  let savedReceiptNo = ''

  const sqlite = getSqlite()
  sqlite.transaction(() => {
    let seq = 0
    for (;;) {
      const candidate = receiptNo(now, seq)
      const exists = db.select({ id: sales.id }).from(sales).where(eq(sales.receiptNo, candidate)).get()
      if (!exists) {
        savedReceiptNo = candidate
        break
      }
      seq += 1
    }
    const saleId = db
      .insert(sales)
      .values({
        receiptNo: savedReceiptNo,
        createdAt,
        subtotal,
        discount,
        total,
        paymentMethod: parsed.paymentMethod,
        cashAmount,
        cardAmount,
        changeAmount,
        status: 'completed',
        canceledAt: null
      })
      .run().lastInsertRowid as number
    for (const { product, qty } of items) {
      const lineTotal = round2(qty * product.sellingPrice)
      db.insert(saleItems)
        .values({
          saleId,
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          qty,
          unitPrice: product.sellingPrice,
          unitCost: product.costPrice,
          lineTotal
        })
        .run()
      const newQty = product.stockQty - qty
      db.update(products)
        .set({ stockQty: newQty, updatedAt: createdAt })
        .where(eq(products.id, product.id))
        .run()
      if (
        notifyLow &&
        stockStatus(product.stockQty, product.minStock) === 'in' &&
        stockStatus(newQty, product.minStock) !== 'in'
      ) {
        lowStock.push({ name: product.name, stockQty: newQty, minStock: product.minStock })
      }
    }
  })()

  return {
    receiptNo: savedReceiptNo,
    createdAt,
    lines: items.map(({ product, qty }) => ({
      productName: product.name,
      qty,
      unit: product.unit,
      unitPrice: product.sellingPrice,
      lineTotal: round2(qty * product.sellingPrice)
    })),
    subtotal,
    discount,
    total,
    paymentMethod: parsed.paymentMethod,
    cashAmount,
    cardAmount,
    changeAmount,
    lowStock
  };
}

// --- Sales History (features §6) ---

/** Paginated list with ISO date range, payment filter and receipt-number search. */
export function listSales(filter: unknown): SaleList {
  const f = saleListFilter.parse(filter)
  const db = getDb()
  const conditions = [gte(sales.createdAt, f.from), lte(sales.createdAt, f.to)]
  if (f.payment !== 'all') conditions.push(eq(sales.paymentMethod, f.payment))
  if (f.search.trim() !== '') conditions.push(sql`lower(${sales.receiptNo}) LIKE ${`%${f.search.trim().toLowerCase()}%`}`)

  const rows = db
    .select({
      id: sales.id,
      receiptNo: sales.receiptNo,
      createdAt: sales.createdAt,
      total: sales.total,
      paymentMethod: sales.paymentMethod,
      status: sales.status,
      itemCount: count(saleItems.id)
    })
    .from(sales)
    .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
    .where(and(...conditions))
    .groupBy(sales.id)
    .orderBy(desc(sales.createdAt))
    .all()

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / SALE_PAGE_SIZE))
  const page = Math.min(f.page, totalPages)
  const items = rows.slice((page - 1) * SALE_PAGE_SIZE, page * SALE_PAGE_SIZE)
  return { items, total, page, totalPages }
}

/** One sale with its lines for the detail panel. */
export function getSale(id: number): SaleDetail {
  const sale = getDb().select().from(sales).where(eq(sales.id, saleId.parse({ id }).id)).get()
  if (!sale) throw new Error('Sale not found')
  const items = getDb().select().from(saleItems).where(eq(saleItems.saleId, sale.id)).all()
  return {
    id: sale.id,
    receiptNo: sale.receiptNo,
    createdAt: sale.createdAt,
    itemCount: items.length,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    status: sale.status,
    subtotal: sale.subtotal,
    discount: sale.discount,
    cashAmount: sale.cashAmount,
    cardAmount: sale.cardAmount,
    changeAmount: sale.changeAmount,
    canceledAt: sale.canceledAt,
    items: items.map((i) => ({
      productName: i.productName,
      qty: i.qty,
      unit: i.unit,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal
    }))
  }
}

/**
 * Cancel an active sale: mark canceled and return all quantities to stock
 * in one transaction (features §6.6). Already-canceled sales are rejected.
 */
export function cancelSale(id: number): SaleDetail {
  const saleIdParsed = saleId.parse({ id }).id
  const db = getDb()
  const sale = db.select().from(sales).where(eq(sales.id, saleIdParsed)).get()
  if (!sale) throw new Error('Sale not found')
  if (sale.status === 'canceled') throw new Error('Sale is already canceled')

  const now = toISO(new Date())
  const sqlite = getSqlite()
  sqlite.transaction(() => {
    const items = db.select().from(saleItems).where(eq(saleItems.saleId, saleIdParsed)).all()
    for (const item of items) {
      if (item.productId === null) continue
      const product = db.select().from(products).where(eq(products.id, item.productId)).get()
      if (!product) continue
      db.update(products)
        .set({ stockQty: product.stockQty + item.qty, updatedAt: now })
        .where(eq(products.id, product.id))
        .run()
    }
    db.update(sales).set({ status: 'canceled', canceledAt: now }).where(eq(sales.id, saleIdParsed)).run()
  })()
  return getSale(saleIdParsed)
}
