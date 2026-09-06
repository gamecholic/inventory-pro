import { eq } from 'drizzle-orm'
import { computeAdjustment, normalizeReason, stockAdjustInput, type StockAdjustInput } from '../../shared/stock'
import { round2 } from '../../shared/money'
import { toISO } from '../../shared/dates'
import type { ProductRow } from '../../shared/products'
import { defaultHandles, type DbHandles } from './client'
import { products, stockAdjustments } from './schema'
import { getProductRow } from './products'

export interface AdjustResult {
  product: ProductRow
  reason: string
}

/** Silent audit row. No UI reads stock_adjustments (§5.4). */
export function logAdjustment(
  handles: DbHandles,
  entry: { productId: number | null; qtyChange: number; type: string; reason: string }
): void {
  handles.db
    .insert(stockAdjustments)
    .values({ ...entry, createdAt: toISO(new Date()) })
    .run()
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
    reason
  })
  const product = getProductRow(parsed.productId, db)
  if (!product) throw new Error('Product not found after adjustment')
  return { product, reason }
}
