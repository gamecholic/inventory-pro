import { and, count, eq, isNull } from 'drizzle-orm'
import {
  productId,
  supplierInput,
  type SupplierInput,
  type SupplierRow
} from '../../shared/products'
import { toISO } from '../../shared/dates'
import { getDb } from './client'
import { products, suppliers } from './schema'

/** Features §4.6. */
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
  return requireSupplier(id)
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
  return requireSupplier(id)
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

function requireSupplier(id: number): SupplierRow {
  const row = getDb().select().from(suppliers).where(eq(suppliers.id, id)).get()
  if (!row) throw new Error('Supplier not found after save')
  return row
}
