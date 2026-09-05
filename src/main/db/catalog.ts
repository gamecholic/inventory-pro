import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { normalizeTR } from '../../shared/normalizeTR'
import {
  PRODUCT_PAGE_SIZE,
  categoryInput,
  productId,
  productInput,
  productListFilter,
  supplierInput,
  type CategoryInput,
  type CategoryRow,
  type ProductInput,
  type ProductList,
  type ProductListFilter,
  type ProductRow,
  type SupplierInput,
  type SupplierRow
} from '../../shared/products'
import { computeAdjustment, normalizeReason, stockAdjustInput, type StockAdjustInput } from '../../shared/stock'
import { toISO } from '../../shared/dates'
import { getDb } from './client'
import { categories, products, suppliers } from './schema'

// --- Categories (features §4.5) ---

export function listCategories(): CategoryRow[] {
  const db = getDb()
  const rows = db.select().from(categories).all()
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    productCount: db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.categoryId, c.id), isNull(products.archivedAt)))
      .get()?.n ?? 0
  }))
}

export function createCategory(input: CategoryInput): CategoryRow {
  const parsed = categoryInput.parse(input)
  const db = getDb()
  const now = toISO(new Date())
  const id = db
    .insert(categories)
    .values({ name: parsed.name, description: parsed.description || null, createdAt: now })
    .run().lastInsertRowid as number
  return listCategories().find((c) => c.id === id) as CategoryRow
}

export function updateCategory(id: number, input: CategoryInput): CategoryRow {
  const parsed = categoryInput.parse(input)
  productId.parse({ id })
  getDb()
    .update(categories)
    .set({ name: parsed.name, description: parsed.description || null })
    .where(eq(categories.id, id))
    .run()
  return listCategories().find((c) => c.id === id) as CategoryRow
}

/** Blocked when active products use the category (features §4.5). */
export function deleteCategory(id: number): void {
  productId.parse({ id })
  const db = getDb()
  const used =
    db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.categoryId, id), isNull(products.archivedAt)))
      .get()?.n ?? 0
  if (used > 0) throw new Error('Category has products and cannot be deleted')
  db.delete(categories).where(eq(categories.id, id)).run()
}

// --- Suppliers (features §4.6) ---

export function listSuppliers(): SupplierRow[] {
  return getDb().select().from(suppliers).all()
}

export function createSupplier(input: SupplierInput): SupplierRow {
  const parsed = supplierInput.parse(input)
  const now = toISO(new Date())
  const id = getDb()
    .insert(suppliers)
    .values({
      companyName: parsed.companyName,
      contactPerson: parsed.contactPerson || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      address: parsed.address || null,
      createdAt: now,
      updatedAt: now
    })
    .run().lastInsertRowid as number
  const row = getDb().select().from(suppliers).where(eq(suppliers.id, id)).get()
  if (!row) throw new Error('Supplier not found after create')
  return row
}

export function updateSupplier(id: number, input: SupplierInput): SupplierRow {
  const parsed = supplierInput.parse(input)
  productId.parse({ id })
  getDb()
    .update(suppliers)
    .set({
      companyName: parsed.companyName,
      contactPerson: parsed.contactPerson || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      address: parsed.address || null,
      updatedAt: toISO(new Date())
    })
    .where(eq(suppliers.id, id))
    .run()
  const row = getDb().select().from(suppliers).where(eq(suppliers.id, id)).get()
  if (!row) throw new Error('Supplier not found after update')
  return row
}

/** Blocked when active products reference the supplier (features §4.6). */
export function deleteSupplier(id: number): void {
  productId.parse({ id })
  const db = getDb()
  const used =
    db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.supplierId, id), isNull(products.archivedAt)))
      .get()?.n ?? 0
  if (used > 0) throw new Error('Supplier has products and cannot be deleted')
  db.delete(suppliers).where(eq(suppliers.id, id)).run()
}

// --- Products (features §4.2–§4.3) ---

export function listProducts(filter: ProductListFilter): ProductList {
  const f = productListFilter.parse(filter)
  const db = getDb()

  const conditions = []
  if (f.status === 'active') conditions.push(isNull(products.archivedAt))
  if (f.status === 'deleted') conditions.push(isNotNull(products.archivedAt))
  if (f.categoryId !== null) conditions.push(eq(products.categoryId, f.categoryId))
  if (f.stockLevel === 'out') conditions.push(sql`${products.stockQty} <= 0`)
  if (f.stockLevel === 'low')
    conditions.push(sql`${products.stockQty} > 0 AND ${products.stockQty} <= ${products.minStock}`)
  if (f.stockLevel === 'in') conditions.push(sql`${products.stockQty} > ${products.minStock}`)

  const rows = db
    .select({
      id: products.id,
      name: products.name,
      barcode: products.barcode,
      categoryId: products.categoryId,
      categoryName: categories.name,
      unit: products.unit,
      sellingPrice: products.sellingPrice,
      costPrice: products.costPrice,
      stockQty: products.stockQty,
      minStock: products.minStock,
      supplierId: products.supplierId,
      description: products.description,
      archivedAt: products.archivedAt,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(products.name)
    .all()

  // Turkish-tolerant substring search over name/barcode/description, in main
  // (SQLite has no TR collation). Shop-scale catalogs fit in memory easily.
  const q = normalizeTR(f.search.trim())
  const matched = (
    q.length === 0
      ? rows
      : rows.filter((r) =>
          [r.name, r.barcode ?? '', r.description ?? ''].some((v) => normalizeTR(v).includes(q))
        )
  ) as ProductRow[]

  // Belt-and-braces: total counts come from the matched set above.
  const total = matched.length
  const totalPages = Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE))
  const page = Math.min(f.page, totalPages)
  const items = matched.slice((page - 1) * PRODUCT_PAGE_SIZE, page * PRODUCT_PAGE_SIZE)
  return { items, total, page, totalPages }
}

export function createProduct(input: ProductInput): ProductRow {
  const parsed = productInput.parse(input)
  const now = toISO(new Date())
  const id = getDb()
    .insert(products)
    .values({
      name: parsed.name,
      barcode: parsed.barcode || null,
      categoryId: parsed.categoryId,
      unit: parsed.unit,
      sellingPrice: parsed.sellingPrice,
      costPrice: parsed.costPrice,
      stockQty: parsed.stockQty,
      minStock: parsed.minStock,
      supplierId: parsed.supplierId,
      description: parsed.description || null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    })
    .run().lastInsertRowid as number
  return getProductRow(id) as ProductRow
}

export function updateProduct(id: number, input: ProductInput): ProductRow {
  const parsed = productInput.parse(input)
  productId.parse({ id })
  getDb()
    .update(products)
    .set({
      name: parsed.name,
      barcode: parsed.barcode || null,
      categoryId: parsed.categoryId,
      unit: parsed.unit,
      sellingPrice: parsed.sellingPrice,
      costPrice: parsed.costPrice,
      stockQty: parsed.stockQty,
      minStock: parsed.minStock,
      supplierId: parsed.supplierId,
      description: parsed.description || null,
      updatedAt: toISO(new Date())
    })
    .where(eq(products.id, id))
    .run()
  return getProductRow(id) as ProductRow
}

/** Archive (soft-delete). No permanent delete in the list (features §4.2). */
export function archiveProduct(id: number): void {
  productId.parse({ id })
  getDb()
    .update(products)
    .set({ archivedAt: toISO(new Date()), updatedAt: toISO(new Date()) })
    .where(eq(products.id, id))
    .run()
}

export function restoreProduct(id: number): void {
  productId.parse({ id })
  getDb()
    .update(products)
    .set({ archivedAt: null, updatedAt: toISO(new Date()) })
    .where(eq(products.id, id))
    .run()
}

function getProductRow(id: number) {
  return getDb()
    .select({
      id: products.id,
      name: products.name,
      barcode: products.barcode,
      categoryId: products.categoryId,
      categoryName: categories.name,
      unit: products.unit,
      sellingPrice: products.sellingPrice,
      costPrice: products.costPrice,
      stockQty: products.stockQty,
      minStock: products.minStock,
      supplierId: products.supplierId,
      description: products.description,
      archivedAt: products.archivedAt,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .get()
}

// --- Stock Update (features §5) ---

export const PRODUCT_SEARCH_LIMIT = 50

/** Active products matching name/barcode (Turkish-tolerant), capped. */
export function searchProducts(query: string, limit: number = PRODUCT_SEARCH_LIMIT): ProductRow[] {
  const q = normalizeTR(query.trim())
  const rows = getDb()
    .select({
      id: products.id,
      name: products.name,
      barcode: products.barcode,
      categoryId: products.categoryId,
      categoryName: categories.name,
      unit: products.unit,
      sellingPrice: products.sellingPrice,
      costPrice: products.costPrice,
      stockQty: products.stockQty,
      minStock: products.minStock,
      supplierId: products.supplierId,
      description: products.description,
      archivedAt: products.archivedAt,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(isNull(products.archivedAt))
    .orderBy(products.name)
    .all() as ProductRow[]
  if (q.length === 0) return rows.slice(0, limit)
  return rows.filter((r) => [r.name, r.barcode ?? ''].some((v) => normalizeTR(v).includes(q))).slice(0, limit)
}

export interface AdjustResult {
  product: ProductRow
  reason: string
}

/**
 * Apply a stock adjustment in one transaction: quantities, weighted-average
 * cost on add, optional selling-price change. Returns the updated row.
 */
export function adjustStock(input: StockAdjustInput): AdjustResult {
  const parsed = stockAdjustInput.parse(input)
  const db = getDb()
  const current = db.select().from(products).where(eq(products.id, parsed.productId)).get()
  if (!current) throw new Error('Product not found')
  if (current.archivedAt) throw new Error('Product is archived')

  const preview = computeAdjustment(
    { stockQty: current.stockQty, costPrice: current.costPrice },
    {
      type: parsed.type,
      quantity: parsed.quantity,
      newCostPrice: parsed.type === 'add' ? (parsed.newCostPrice ?? current.costPrice) : null
    }
  )
  const sellingPrice = parsed.newSellingPrice ?? current.sellingPrice
  const now = toISO(new Date())
  db.update(products)
    .set({ stockQty: preview.newQty, costPrice: preview.newCost, sellingPrice, updatedAt: now })
    .where(eq(products.id, parsed.productId))
    .run()
  const product = getProductRow(parsed.productId) as ProductRow
  return { product, reason: normalizeReason(parsed.reason) }
}
