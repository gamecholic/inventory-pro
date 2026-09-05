import { eq } from 'drizzle-orm'
import { computeAdjustment, normalizeReason, stockAdjustInput, type StockAdjustInput } from '../../shared/stock'
import { round2 } from '../../shared/money'
import { toISO } from '../../shared/dates'
import type { ProductRow } from '../../shared/products'
import { getDb } from './client'
import { products } from './schema'
import { getProductRow } from './products'

export interface AdjustResult {
  product: ProductRow
  reason: string
}

/**
 * Apply a stock adjustment in one transaction: quantities, weighted-average
 * cost on add, optional selling-price change. Returns the updated row.
 */
export function adjustStock(input: StockAdjustInput): AdjustResult {
  const parsed = stockAdjustInput.parse(input)
  const db = getDb()
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
  const now = toISO(new Date())
  db.update(products)
    .set({ stockQty: preview.newQty, costPrice: round2(preview.newCost), sellingPrice, updatedAt: now })
    .where(eq(products.id, parsed.productId))
    .run()
  const product = getProductRow(parsed.productId)
  if (!product) throw new Error('Product not found after adjustment')
  return { product, reason: normalizeReason(parsed.reason) }
}
