import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DeadStockInput, RangeInput, TopProductsInput } from '@shared/analytics'

/** Thin TanStack wrappers over the analytics IPC. Pages own draft/applied state. */
export function useFinancialMetrics(range: RangeInput | null) {
  return useQuery({
    queryKey: ['report-financial', range],
    queryFn: () => window.api.analytics.financial(range as RangeInput),
    enabled: range !== null,
    placeholderData: keepPreviousData
  })
}

export function useTopProductsReport(input: TopProductsInput | null) {
  return useQuery({
    queryKey: ['report-top-products', input],
    queryFn: () => window.api.analytics.topProducts(input as TopProductsInput),
    enabled: input !== null,
    placeholderData: keepPreviousData
  })
}

export function usePaymentReport(range: RangeInput | null) {
  return useQuery({
    queryKey: ['report-payment', range],
    queryFn: () => window.api.analytics.payment(range as RangeInput),
    enabled: range !== null,
    placeholderData: keepPreviousData
  })
}

export function useCardFeeReport(range: RangeInput | null) {
  return useQuery({
    queryKey: ['report-card-fees', range],
    queryFn: () => window.api.analytics.cardFees(range as RangeInput),
    enabled: range !== null,
    placeholderData: keepPreviousData
  })
}

export function useSupplierReport(range: RangeInput | null) {
  return useQuery({
    queryKey: ['report-supplier', range],
    queryFn: () => window.api.analytics.supplier(range as RangeInput),
    enabled: range !== null,
    placeholderData: keepPreviousData
  })
}

export function useCategoryReport(range: RangeInput | null) {
  return useQuery({
    queryKey: ['report-category', range],
    queryFn: () => window.api.analytics.category(range as RangeInput),
    enabled: range !== null,
    placeholderData: keepPreviousData
  })
}

export function useExpenseReport(range: RangeInput | null) {
  return useQuery({
    queryKey: ['report-expenses', range],
    queryFn: () => window.api.analytics.expenses(range as RangeInput),
    enabled: range !== null,
    placeholderData: keepPreviousData
  })
}

export function useReorderReport() {
  return useQuery({ queryKey: ['report-reorder'], queryFn: () => window.api.analytics.reorder() })
}

export function useDeadStockReport(input: DeadStockInput) {
  return useQuery({
    queryKey: ['report-dead-stock', input],
    queryFn: () => window.api.analytics.deadStock(input.days),
    placeholderData: keepPreviousData
  })
}

export function useBasketReport(range: RangeInput | null) {
  return useQuery({
    queryKey: ['report-basket', range],
    queryFn: () => window.api.analytics.basket(range as RangeInput),
    enabled: range !== null,
    placeholderData: keepPreviousData
  })
}

export function useDiscountReport(range: RangeInput | null) {
  return useQuery({
    queryKey: ['report-discounts', range],
    queryFn: () => window.api.analytics.discounts(range as RangeInput),
    enabled: range !== null,
    placeholderData: keepPreviousData
  })
}
