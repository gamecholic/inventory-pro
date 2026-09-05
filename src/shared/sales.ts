import { z } from 'zod'
import { isoDateTime } from './api'

export const SALE_PAGE_SIZE = 10

/** Features §6.2 — applied-together date range + instant payment/search. Dates are ISO8601 UTC. */
export const saleListFilter = z.object({
  from: isoDateTime,
  to: isoDateTime,
  payment: z.enum(['all', 'cash', 'card', 'split']).default('all'),
  search: z.string().max(100).default(''),
  page: z.number().int().min(1).default(1)
})
export type SaleListFilter = z.infer<typeof saleListFilter>

export const saleId = z.object({ id: z.number().int().positive() })

export interface SaleRow {
  id: number
  receiptNo: string
  createdAt: string
  itemCount: number
  total: number
  paymentMethod: string
  status: string
}

export interface SaleList {
  items: SaleRow[]
  total: number
  page: number
  totalPages: number
}

export interface SaleItemRow {
  productName: string | null
  qty: number
  unit: string
  unitPrice: number
  lineTotal: number
}

export interface SaleDetail extends SaleRow {
  subtotal: number
  discount: number
  cashAmount: number | null
  cardAmount: number | null
  changeAmount: number
  canceledAt: string | null
  items: SaleItemRow[]
}
