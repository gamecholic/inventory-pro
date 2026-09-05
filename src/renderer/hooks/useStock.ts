import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { StockAdjustInput } from '@shared/stock'

/** Left-pane product search (features §5.1). Query key includes the text. */
export function useProductSearch(query: string) {
  return useQuery({
    queryKey: ['product-search', query],
    queryFn: () => window.api.products.search(query)
  })
}

export function useAdjustStock() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: StockAdjustInput) => window.api.stock.adjust(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['product-search'] })
      toast.success(t('stock.updated'))
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('products.actionFailed'))
    }
  })
}
