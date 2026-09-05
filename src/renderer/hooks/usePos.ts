import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { CheckoutInput } from '@shared/sale'
import type { Receipt } from '@shared/sale'

/** Full active catalog for the grid (shop-scale; filtered client-side per §3.1). */
export function usePosCatalog() {
  return useQuery({ queryKey: ['pos-catalog'], queryFn: () => window.api.products.search('', 2000) })
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => window.api.categories.list() })
}

export function useCompleteSale(onPaid: (receipt: Receipt) => void) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CheckoutInput) => window.api.sales.complete(input),
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({ queryKey: ['pos-catalog'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['product-search'] })
      onPaid(receipt)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('pos.saleFailed'))
    }
  })
}
