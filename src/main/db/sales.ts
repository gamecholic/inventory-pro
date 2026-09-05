import { eq } from 'drizzle-orm'
import { cartSubtotal, checkoutInput, computeChange, computeDiscount, receiptNo, type CheckoutInput, type LowStockAlert, type Receipt } from '../../shared/sale'
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
