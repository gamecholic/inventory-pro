import { z } from 'zod'

/** Features §5.2 — quantity must be a positive whole number. */
export const stockAdjustInput = z.object({
  productId: z.number().int().positive(),
  type: z.enum(['add', 'remove']),
  quantity: z.number().int().min(1),
  newCostPrice: z.number().min(0).nullable().default(null),
  newSellingPrice: z.number().min(0).nullable().default(null),
  reason: z.string().trim().max(1000).default('')
})
export type StockAdjustInput = z.infer<typeof stockAdjustInput>

export interface AdjustmentPreview {
  currentQty: number
  currentCost: number
  currentValue: number
  newQty: number
  newCost: number
  newValue: number
}

/**
 * Cost-averaging math (features §5.3), shared by the live preview and the save path.
 * Add: weighted-average cost. Remove: cost unchanged, stock floored at 0.
 */
export function computeAdjustment(
  current: { stockQty: number; costPrice: number },
  input: { type: 'add' | 'remove'; quantity: number; newCostPrice: number | null }
): AdjustmentPreview {
  const currentValue = current.stockQty * current.costPrice
  if (input.type === 'remove') {
    const newQty = Math.max(0, current.stockQty - input.quantity)
    return {
      currentQty: current.stockQty,
      currentCost: current.costPrice,
      currentValue,
      newQty,
      newCost: current.costPrice,
      newValue: newQty * current.costPrice
    }
  }
  const cost = input.newCostPrice ?? current.costPrice
  const newQty = current.stockQty + input.quantity
  const newValue = currentValue + input.quantity * cost
  return {
    currentQty: current.stockQty,
    currentCost: current.costPrice,
    currentValue,
    newQty,
    newCost: newQty === 0 ? cost : newValue / newQty,
    newValue
  }
}

/** Empty reason is saved as 'Stock adjustment' (features §5.2). */
export function normalizeReason(reason: string): string {
  return reason.trim() === '' ? 'Stock adjustment' : reason.trim()
}

export const priceHistoryInput = z.object({ productId: z.number().int().positive() })

/** One priced movement for the stock-page chart. Rows without prices are excluded. */
export interface PricePoint {
  createdAt: string
  type: string
  costPrice: number | null
  sellingPrice: number | null
}
