import { z } from 'zod'

export type DiscountType = 'fixed' | 'percent' | 'settotal'

/** Features §3.7 — discount entry as held in the cart. */
export const discountInput = z.object({
  type: z.enum(['fixed', 'percent', 'settotal']),
  value: z.number()
})
export type DiscountInput = z.infer<typeof discountInput>

export const cartLineInput = z.object({
  productId: z.number().int().positive(),
  qty: z.number().int().min(1)
})
export type CartLineInput = z.infer<typeof cartLineInput>

/**
 * Features §3.7 rules, single implementation for cart preview and checkout:
 * - empty/invalid/negative → 0
 * - percent capped at 100% (over 100% = full subtotal)
 * - fixed capped at subtotal (over subtotal → subtotal, total 0)
 * - set-total: desired > subtotal → no discount, else subtotal − desired
 */
export function computeDiscount(subtotal: number, discount: DiscountInput): number {
  const base = subtotal <= 0 ? 0 : subtotal
  if (!Number.isFinite(discount.value) || discount.value <= 0) return 0
  switch (discount.type) {
    case 'percent':
      return Math.min(base, (base * Math.min(discount.value, 100)) / 100)
    case 'fixed':
      return Math.min(base, discount.value)
    case 'settotal':
      return discount.value >= base ? 0 : base - discount.value
  }
}

export function cartSubtotal(lines: Array<{ qty: number; unitPrice: number }>): number {
  return lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
}

/** Change = max(0, paid − total). Never negative. */
export function computeChange(paid: number, total: number): number {
  return Math.max(0, paid - total)
}

/** Shortfall shown in red when paid < total (features §3.9). */
export function computeShortfall(paid: number, total: number): number {
  return Math.max(0, total - paid)
}

/**
 * Receipt number `INV-YYYYMMDD-HHmmss` (features §3.11), local time.
 * A numeric suffix breaks same-second collisions.
 */
export function receiptNo(date: Date = new Date(), seq = 0): string {
  const p = (n: number, len = 2): string => String(n).padStart(len, '0')
  const base =
    `INV-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  return seq > 0 ? `${base}-${seq}` : base
}

export type PaymentMethod = 'cash' | 'card' | 'split'

export interface ReceiptLine {
  productName: string
  qty: number
  unit: string
  unitPrice: number
  lineTotal: number
}

export interface LowStockAlert {
  name: string
  stockQty: number
  minStock: number
}

/** What checkout returns: receipt data + post-sale low-stock alerts (features §1.5, §3.11). */
export interface Receipt {
  receiptNo: string
  createdAt: string
  lines: ReceiptLine[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  cashAmount: number | null
  cardAmount: number | null
  changeAmount: number
  lowStock: LowStockAlert[]
}

export const checkoutInput = z.object({
  lines: z.array(cartLineInput).min(1),
  discount: discountInput,
  paymentMethod: z.enum(['cash', 'card', 'split']),
  cashAmount: z.number().min(0).nullable().default(null),
  cardAmount: z.number().min(0).nullable().default(null)
})
export type CheckoutInput = z.infer<typeof checkoutInput>
