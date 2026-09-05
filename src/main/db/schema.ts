import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Key-value settings store (features §9). Value holds one JSON section. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull()
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  barcode: text('barcode'),
  categoryId: integer('category_id').references(() => categories.id),
  unit: text('unit').notNull().default('pcs'),
  sellingPrice: real('selling_price').notNull().default(0),
  costPrice: real('cost_price').notNull().default(0),
  stockQty: real('stock_qty').notNull().default(0),
  minStock: real('min_stock').notNull().default(5),
  supplierId: integer('supplier_id'),
  description: text('description'),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})
