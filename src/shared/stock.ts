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
  // Add quantity is at least 1 (stockAdjustInput), so newQty is never 0 here.
  return {
    currentQty: current.stockQty,
    currentCost: current.costPrice,
    currentValue,
    newQty,
    newCost: newValue / newQty,
    newValue
  }
}

/** Empty reason is saved as 'Stock adjustment' (features §5.2). */
export function normalizeReason(reason: string): string {
  return reason.trim() === '' ? 'Stock adjustment' : reason.trim()
}

/**
 * Margin as a share of the selling price (features §5.3). Null when there is no
 * selling price to measure against, so the UI can print an em dash.
 */
export function marginPct(selling: number, cost: number): number | null {
  if (!Number.isFinite(selling) || selling <= 0) return null
  return ((selling - cost) / selling) * 100
}

/**
 * Selling price that keeps `margin` percent on `cost` — the "keep my margin"
 * action. Null when the margin cannot be kept (no margin, or 100% and above).
 * Unrounded: the caller decides how many decimals the shop trades in.
 */
export function priceForMargin(cost: number, margin: number | null): number | null {
  if (margin === null || margin >= 100) return null
  const price = cost / (1 - margin / 100)
  return Number.isFinite(price) && price >= 0 ? price : null
}

export const priceHistoryInput = z.object({ productId: z.number().int().positive() })

/** One priced movement for the stock-page chart. Rows without prices are excluded. */
export interface PricePoint {
  createdAt: string
  type: string
  costPrice: number | null
  sellingPrice: number | null
  reason: string
}
