import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { SaleListFilter } from '@shared/sales'

export const salesKey = (filter: SaleListFilter) => ['sales', filter] as const
export const saleKey = (id: number | null) => ['sale', id] as const

/** Paginated sales list (features §6.1–§6.2). */
export function useSales(filter: SaleListFilter) {
  return useQuery({ queryKey: salesKey(filter), queryFn: () => window.api.sales.list(filter) })
}

export function useSale(id: number | null) {
  return useQuery({
    queryKey: saleKey(id),
    queryFn: () => window.api.sales.get(id as number),
    enabled: id !== null
  })
}

export function useCancelSale() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.sales.cancel(id),
    onSuccess: (detail) => {
      queryClient.setQueryData(saleKey(detail.id), detail)
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['pos-catalog'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['product-search'] })
      toast.success(t('sales.canceledMsg'))
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('sales.cancelFailed'))
    }
  })
}
