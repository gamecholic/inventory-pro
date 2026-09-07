import { asc, eq } from 'drizzle-orm'
import { computeAdjustment, normalizeReason, stockAdjustInput, type PricePoint, type StockAdjustInput } from '../../shared/stock'
import { round2 } from '../../shared/money'
import { toISO } from '../../shared/dates'
import type { ProductRow } from '../../shared/products'
import { defaultHandles, type DbHandles } from './client'
import { products, stockAdjustments } from './schema'
import { getProductRow } from './products'
import { logAdjustment } from './movements'

export interface AdjustResult {
  product: ProductRow
  reason: string
}

/** Price trail for the stock-page chart: every logged movement carrying prices, oldest first. */
export function getPriceHistory(productId: number, db = defaultHandles().db): PricePoint[] {
  return db
    .select({
      createdAt: stockAdjustments.createdAt,
      type: stockAdjustments.type,
      costPrice: stockAdjustments.costPrice,
      sellingPrice: stockAdjustments.sellingPrice
    })
    .from(stockAdjustments)
    .where(eq(stockAdjustments.productId, productId))
    .orderBy(asc(stockAdjustments.createdAt), asc(stockAdjustments.id))
    .all()
    .filter((r) => r.costPrice !== null || r.sellingPrice !== null)
}

/**
 * Apply a stock adjustment in one transaction: quantities, weighted-average
 * cost on add, optional selling-price change. Logs the movement silently.
 * Returns the updated row.
 */
export function adjustStock(input: StockAdjustInput, handles: DbHandles = defaultHandles()): AdjustResult {
  const parsed = stockAdjustInput.parse(input)
  const { db } = handles
  const current = db.select().from(products).where(eq(products.id, parsed.productId)).get()
  if (!current) throw new Error('Product not found')
  if (current.archivedAt) throw new Error('Product is archived')

  const preview = computeAdjustment(
    { stockQty: current.stockQty, costPrice: current.costPrice },
    {
      type: parsed.type,
      quantity: parsed.quantity,
      newCostPrice: parsed.type === 'add' ? (parsed.newCostPrice ?? current.costPrice) : null
    }
  )
  const sellingPrice = round2(parsed.newSellingPrice ?? current.sellingPrice)
  const reason = normalizeReason(parsed.reason)
  const now = toISO(new Date())
  db.update(products)
    .set({ stockQty: preview.newQty, costPrice: round2(preview.newCost), sellingPrice, updatedAt: now })
    .where(eq(products.id, parsed.productId))
    .run()
  logAdjustment(handles, {
    productId: parsed.productId,
    qtyChange: parsed.type === 'add' ? parsed.quantity : -parsed.quantity,
    type: parsed.type,
    reason,
    costPrice: round2(preview.newCost),
    sellingPrice
  })
  const product = getProductRow(parsed.productId, db)
  if (!product) throw new Error('Product not found after adjustment')
  return { product, reason }
}
