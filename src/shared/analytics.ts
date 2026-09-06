import { z } from 'zod'
import { isoDateTime } from './api'

/** Every aggregation takes an ISO8601 UTC range — dashboard presets and report pickers alike. */
export const rangeInput = z.object({ from: isoDateTime, to: isoDateTime })
export type RangeInput = z.infer<typeof rangeInput>

export const topProductsInput = rangeInput.extend({
  sort: z.enum(['revenue', 'profit', 'quantity']).default('revenue'),
  limit: z.number().int().min(1).max(50).default(10)
})
export type TopProductsInput = z.infer<typeof topProductsInput>

export const deadStockInput = z.object({ days: z.number().int().min(1).max(365).default(60) })
export type DeadStockInput = z.infer<typeof deadStockInput>

/** §8.1 — period financials. Cash = cash revenue minus expenses. */
export interface FinancialMetrics {
  revenue: number
  profit: number
  margin: number
  expenses: number
  cashRevenue: number
  totalCash: number
  revenueExpenseDiff: number
}

export interface TopProductRow {
  productId: number | null
  name: string
  quantity: number
  revenue: number
  profit: number
  margin: number
}

/** §8.4 — discounts excluded from this breakdown (spec warning preserved). */
export interface SupplierRevenueRow {
  supplierId: number | null
  name: string
  revenue: number
  profit: number
  margin: number
}

export interface PaymentRevenueRow {
  method: string
  revenue: number
  share: number
}

export interface CardFeeSummary {
  cardRevenue: number
  feePercent: number
  feeAmount: number
  netCard: number
}

export interface CategoryProfitRow {
  categoryId: number | null
  name: string
  revenue: number
  cost: number
  profit: number
  margin: number
}

export interface ExpenseSummary {
  total: number
  byCategory: Array<{ categoryId: number | null; name: string; total: number }>
}

/** Days of cover = stock ÷ trailing-30d daily sales. Null when never sold. */
export interface ReorderRow {
  productId: number
  name: string
  stockQty: number
  unit: string
  minStock: number
  avgDailySales: number
  daysOfCover: number | null
}

export interface DeadStockRow {
  productId: number
  name: string
  stockQty: number
  unit: string
  tiedValue: number
  lastSoldAt: string | null
}

export interface BasketPoint {
  day: string
  sales: number
  items: number
  revenue: number
  avgItems: number
  avgValue: number
}

export interface DiscountSummary {
  gross: number
  discount: number
  share: number
  discountedSales: number
  perDay: Array<{ day: string; discount: number }>
}

export interface CardFeePoint {
  day: string
  cardRevenue: number
  feeAmount: number
}

export interface CardFeeReport extends CardFeeSummary {
  perDay: CardFeePoint[]
}

/** §2.1 metric cards that aren't covered by FinancialMetrics. */
export interface InventoryOverview {
  totalProducts: number
  lowStockItems: number
  todaySales: number
  inventoryValue: number
  turnover: number
}

export interface InventoryValueRow {
  key: string
  name: string
  value: number
  items: number
  share: number
}

export interface TrendPoint {
  month: string
  revenue: number
  profit: number
}

export interface WeekdayPoint {
  weekday: number
  sales: number
  revenue: number
  avgSales: number
  avgRevenue: number
}

export interface MonthPoint {
  month: number
  sales: number
  revenue: number
  avgSales: number
  avgRevenue: number
}

export const yearInput = z.object({ year: z.number().int().min(2000).max(2100) })
export type YearInput = z.infer<typeof yearInput>
