import { create } from 'zustand'
import type { DiscountType } from '@shared/sale'
import type { ProductRow } from '@shared/products'

export interface CartItem {
  product: ProductRow
  qty: number
}

export type AddResult = 'ok' | 'out' | 'insufficient'

interface CartState {
  items: CartItem[]
  discountType: DiscountType
  discountValue: number
  /** Add one unit. Enforces §3.6 stock rules, reports the outcome for toasts. */
  add: (product: ProductRow) => AddResult
  setQty: (productId: number, qty: number) => void
  remove: (productId: number) => void
  clear: () => void
  setDiscount: (type: DiscountType, value: number) => void
  clearDiscount: () => void
}

/** Ephemeral sale state. Truth (stock, prices) always comes from the catalog query. */
export const useCartStore = create<CartState>()((set) => ({
  items: [],
  discountType: 'fixed',
  discountValue: 0,

  add: (product) => {
    if (product.stockQty <= 0) return 'out'
    let result: AddResult = 'ok'
    set((s) => {
      const existing = s.items.find((i) => i.product.id === product.id)
      const current = existing?.qty ?? 0
      if (current + 1 > product.stockQty) {
        result = 'insufficient'
        return s
      }
      // Refresh snapshot so price/stock stay current.
      const items = existing
        ? s.items.map((i) => (i.product.id === product.id ? { product, qty: i.qty + 1 } : i))
        : [...s.items, { product, qty: 1 }]
      return { ...s, items }
    })
    return result
  },

  setQty: (productId, qty) =>
    set((s) => ({
      ...s,
      items: s.items.map((i) => {
        if (i.product.id !== productId) return i
        const clamped = Math.max(1, Math.min(Math.floor(qty || 1), Math.max(1, i.product.stockQty)))
        return { ...i, qty: clamped }
      })
    })),

  remove: (productId) =>
    set((s) => ({ ...s, items: s.items.filter((i) => i.product.id !== productId) })),

  clear: () => set({ items: [], discountType: 'fixed', discountValue: 0 }),

  setDiscount: (discountType, discountValue) => set((s) => ({ ...s, discountType, discountValue })),

  clearDiscount: () => set((s) => ({ ...s, discountType: 'fixed' as DiscountType, discountValue: 0 }))
}))
