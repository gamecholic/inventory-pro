import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { normalizeTR } from '../../shared/normalizeTR'
import {
  PRODUCT_PAGE_SIZE,
  productId,
  productInput,
  productListFilter,
  type ProductInput,
  type ProductList,
  type ProductListFilter,
  type ProductRow
} from '../../shared/products'
import { round2 } from '../../shared/money'
import { toISO } from '../../shared/dates'
import { getDb } from './client'
import { categories, products } from './schema'

/** Product + category name in one query. Shared by list, search and single-row reads. */
function productColumns() {
  return {
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
  }
}

export function getProductRow(id: number, db = getDb()): ProductRow | undefined {
  return db
    .select(productColumns())
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .get() as ProductRow | undefined
}

function requireProductRow(id: number): ProductRow {
  const row = getProductRow(id)
  if (!row) throw new Error('Product not found after save')
  return row
}

/**
 * Friendly duplicate-barcode guard ahead of the unique index: empty barcodes
 * are always free, otherwise no other product may hold the code (excludes self
 * on update). Protects POS exact-barcode lookup (§3.3).
 */
function assertBarcodeFree(barcode: string, selfId: number | null): void {
  const code = barcode.trim()
  if (code === '') return
  const clash = getDb().select({ id: products.id }).from(products).where(eq(products.barcode, code)).get()
  if (clash && clash.id !== selfId) throw new Error(`Barcode ${code} is already used by another product`)
}

/** Features §4.3 — SQL filters plus Turkish-tolerant in-main search (SQLite has no TR collation). */
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
    .select(productColumns())
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(products.name)
    .all() as ProductRow[]

  // Shop-scale catalogs fit in memory easily.
  const q = normalizeTR(f.search.trim())
  const matched =
    q.length === 0
      ? rows
      : rows.filter((r) => [r.name, r.barcode ?? '', r.description ?? ''].some((v) => normalizeTR(v).includes(q)))

  const total = matched.length
  const totalPages = Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE))
  const page = Math.min(f.page, totalPages)
  const items = matched.slice((page - 1) * PRODUCT_PAGE_SIZE, page * PRODUCT_PAGE_SIZE)
  return { items, total, page, totalPages }
}

export function createProduct(input: ProductInput): ProductRow {
  const parsed = productInput.parse(input)
  assertBarcodeFree(parsed.barcode, null)
  const now = toISO(new Date())
  const id = getDb()
    .insert(products)
    .values({
      name: parsed.name,
      barcode: parsed.barcode || null,
      categoryId: parsed.categoryId,
      unit: parsed.unit,
      sellingPrice: round2(parsed.sellingPrice),
      costPrice: round2(parsed.costPrice),
      stockQty: parsed.stockQty,
      minStock: parsed.minStock,
      supplierId: parsed.supplierId,
      description: parsed.description || null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    })
    .run().lastInsertRowid as number
  return requireProductRow(id)
}

export function updateProduct(id: number, input: ProductInput): ProductRow {
  const parsed = productInput.parse(input)
  productId.parse({ id })
  assertBarcodeFree(parsed.barcode, id)
  getDb()
    .update(products)
    .set({
      name: parsed.name,
      barcode: parsed.barcode || null,
      categoryId: parsed.categoryId,
      unit: parsed.unit,
      sellingPrice: round2(parsed.sellingPrice),
      costPrice: round2(parsed.costPrice),
      stockQty: parsed.stockQty,
      minStock: parsed.minStock,
      supplierId: parsed.supplierId,
      description: parsed.description || null,
      updatedAt: toISO(new Date())
    })
    .where(eq(products.id, id))
    .run()
  return requireProductRow(id)
}

/** Archive (soft-delete). No permanent delete in the list (features §4.2). */
export function archiveProduct(id: number): void {
  productId.parse({ id })
  const now = toISO(new Date())
  getDb().update(products).set({ archivedAt: now, updatedAt: now }).where(eq(products.id, id)).run()
}

export function restoreProduct(id: number): void {
  productId.parse({ id })
  getDb().update(products).set({ archivedAt: null, updatedAt: toISO(new Date()) }).where(eq(products.id, id)).run()
}

/** Features §5.1 — active products matching name/barcode (Turkish-tolerant), capped. */
export function searchProducts(query: string, limit = 50): ProductRow[] {
  const q = normalizeTR(query.trim())
  const rows = getDb()
    .select(productColumns())
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(isNull(products.archivedAt))
    .orderBy(products.name)
    .all() as ProductRow[]
  if (q.length === 0) return rows.slice(0, limit)
  return rows.filter((r) => [r.name, r.barcode ?? ''].some((v) => normalizeTR(v).includes(q))).slice(0, limit)
}
