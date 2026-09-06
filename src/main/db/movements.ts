import { toISO } from '../../shared/dates'
import type { DbHandles } from './client'
import { stockAdjustments } from './schema'

export type MovementType = 'add' | 'remove' | 'sale' | 'restore' | 'edit' | 'create'

/**
 * Silent audit row. No UI except the stock price-history chart reads these
 * (price columns); the qty/reason trail stays UI-free (§5.4).
 */
export function logAdjustment(
  handles: DbHandles,
  entry: {
    productId: number | null
    qtyChange: number
    type: MovementType
    reason: string
    costPrice?: number | null
    sellingPrice?: number | null
  }
): void {
  handles.db
    .insert(stockAdjustments)
    .values({
      productId: entry.productId,
      qtyChange: entry.qtyChange,
      type: entry.type,
      reason: entry.reason,
      costPrice: entry.costPrice ?? null,
      sellingPrice: entry.sellingPrice ?? null,
      createdAt: toISO(new Date())
    })
    .run()
}
