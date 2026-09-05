import { z } from 'zod'
import { UNIT_VALUES } from './units'

export type StockLevel = 'out' | 'low' | 'in'
export type ProductStatus = 'active' | 'deleted' | 'all'

/**
 * Low-stock detection (features §1.5):
 * out when qty <= 0, low when 0 < qty <= threshold, in otherwise.
 */
export function stockStatus(qty: number, threshold: number): StockLevel {
  if (qty <= 0) return 'out'
  if (qty <= threshold) return 'low'
  return 'in'
}

/** Features §4.1 — shared by the product form and the IPC boundary. */
export const productInput = z.object({
  name: z.string().trim().min(1).max(200),
  barcode: z.string().trim().max(100).default(''),
  categoryId: z.number().int().positive(),
  unit: z.enum(UNIT_VALUES).default('pcs'),
  sellingPrice: z.number().min(0),
  costPrice: z.number().min(0),
  stockQty: z.number().min(0).default(0),
  minStock: z.number().min(0).default(5),
  supplierId: z.number().int().positive().nullable().default(null),
  description: z.string().max(2000).default('')
})
export type ProductInput = z.infer<typeof productInput>

export const productId = z.object({ id: z.number().int().positive() })

/** Features §5.1 — left-pane product search (name/barcode/SKU). */
export const productSearchInput = z.object({ query: z.string().max(200) })

/** Features §4.3 — list filters. Search matches name/barcode/description (Turkish-tolerant). */
export const productListFilter = z.object({
  search: z.string().max(200).default(''),
  categoryId: z.number().int().positive().nullable().default(null),
  stockLevel: z.enum(['all', 'out', 'low', 'in']).default('all'),
  status: z.enum(['active', 'deleted', 'all']).default('active'),
  page: z.number().int().min(1).default(1)
})
export type ProductListFilter = z.infer<typeof productListFilter>
export const PRODUCT_PAGE_SIZE = 10

/** Features §4.5. */
export const categoryInput = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default('')
})
export type CategoryInput = z.infer<typeof categoryInput>

/** Features §4.6. */
export const supplierInput = z.object({
  companyName: z.string().trim().min(1).max(200),
  contactPerson: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(50).default(''),
  email: z.union([z.literal(''), z.string().email().max(200)]).default(''),
  address: z.string().trim().max(1000).default('')
})
export type SupplierInput = z.infer<typeof supplierInput>

/** Updates carry the id plus a full validated body (form resubmits whole record). */
export const updateProductInput = productInput.extend({ id: z.number().int().positive() })
export const updateCategoryInput = categoryInput.extend({ id: z.number().int().positive() })
export const updateSupplierInput = supplierInput.extend({ id: z.number().int().positive() })

/**
 * Row shapes shared by main (Drizzle selects must satisfy these) and renderer.
 * Kept here so renderer never imports main code, not even types.
 */
export interface SupplierRow {
  id: number
  companyName: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  createdAt: string
  updatedAt: string
}

export interface CategoryRow {
  id: number
  name: string
  description: string | null
  productCount: number
}

export interface ProductRow {
  id: number
  name: string
  barcode: string | null
  categoryId: number | null
  categoryName: string | null
  unit: string
  sellingPrice: number
  costPrice: number
  stockQty: number
  minStock: number
  supplierId: number | null
  description: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductList {
  items: ProductRow[]
  total: number
  page: number
  totalPages: number
}
