import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type {
  CategoryInput,
  ProductInput,
  ProductListFilter,
  SupplierInput
} from '@shared/products'

export const productsKey = (filter: ProductListFilter) => ['products', filter] as const
export const categoriesKey = ['categories'] as const
export const suppliersKey = ['suppliers'] as const

function useInvalidateCatalog() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['products'] })
    void queryClient.invalidateQueries({ queryKey: categoriesKey })
    void queryClient.invalidateQueries({ queryKey: suppliersKey })
  }
}

function useCatalogMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, successKey: string) {
  const { t } = useTranslation()
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate()
      toast.success(t(successKey))
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('products.actionFailed'))
    }
  })
}

/** Paginated, filtered product list (features §4.3). Filter is part of the query key. */
export function useProducts(filter: ProductListFilter) {
  return useQuery({ queryKey: productsKey(filter), queryFn: () => window.api.products.list(filter) })
}

export function useCreateProduct() {
  return useCatalogMutation((input: ProductInput) => window.api.products.create(input), 'products.created')
}

export function useUpdateProduct() {
  return useCatalogMutation(
    ({ id, input }: { id: number; input: ProductInput }) => window.api.products.update(id, input),
    'products.updated'
  )
}

export function useArchiveProduct() {
  return useCatalogMutation((id: number) => window.api.products.archive(id), 'products.archived')
}

export function useRestoreProduct() {
  return useCatalogMutation((id: number) => window.api.products.restore(id), 'products.restored')
}

export function useCategories() {
  return useQuery({ queryKey: categoriesKey, queryFn: () => window.api.categories.list() })
}

export function useCreateCategory() {
  return useCatalogMutation((input: CategoryInput) => window.api.categories.create(input), 'products.created')
}

export function useUpdateCategory() {
  return useCatalogMutation(
    ({ id, input }: { id: number; input: CategoryInput }) => window.api.categories.update(id, input),
    'products.updated'
  )
}

export function useDeleteCategory() {
  return useCatalogMutation((id: number) => window.api.categories.remove(id), 'products.deleted')
}

export function useSuppliers() {
  return useQuery({ queryKey: suppliersKey, queryFn: () => window.api.suppliers.list() })
}

export function useCreateSupplier() {
  return useCatalogMutation((input: SupplierInput) => window.api.suppliers.create(input), 'products.created')
}

export function useUpdateSupplier() {
  return useCatalogMutation(
    ({ id, input }: { id: number; input: SupplierInput }) => window.api.suppliers.update(id, input),
    'products.updated'
  )
}

export function useDeleteSupplier() {
  return useCatalogMutation((id: number) => window.api.suppliers.remove(id), 'products.deleted')
}
