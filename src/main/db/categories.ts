import { and, count, eq, isNull } from 'drizzle-orm'
import {
  categoryInput,
  productId,
  type CategoryInput,
  type CategoryRow
} from '../../shared/products'
import { toISO } from '../../shared/dates'
import { getDb } from './client'
import { categories, products } from './schema'

/** Features §4.5 — categories with active-product counts. */
export function listCategories(): CategoryRow[] {
  const db = getDb()
  const rows = db.select().from(categories).all()
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    productCount: activeProductCount(c.id)
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
  if (activeProductCount(id) > 0) throw new Error('Category has products and cannot be deleted')
  db.delete(categories).where(eq(categories.id, id)).run()
}

function activeProductCount(categoryId: number): number {
  return (
    getDb()
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.categoryId, categoryId), isNull(products.archivedAt)))
      .get()?.n ?? 0
  )
}
