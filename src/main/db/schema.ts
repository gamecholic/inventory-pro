import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyName: text('company_name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

/** Expense categories, separate from product categories (features §7.3). */
export const expenseCategories = sqliteTable('expense_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull()
})

/** Features §7.2 — no recurrence, no attachments. */
export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  categoryId: integer('category_id').references(() => expenseCategories.id),
  paymentMethod: text('payment_method').notNull().default('cash'),
  recipient: text('recipient'),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
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
}, (t) => [
  // Nullable: SQLite permits multiple NULLs, so optional barcodes stay free
  // while duplicates are rejected (protects POS exact-barcode lookup, §3.3).
  uniqueIndex('products_barcode_unique').on(t.barcode),
  index('products_category_idx').on(t.categoryId),
  index('products_supplier_idx').on(t.supplierId)
])

/** Completed/canceled sales (features §3, §6). Product data snapshotted into items. */
export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  receiptNo: text('receipt_no').notNull().unique(),
  createdAt: text('created_at').notNull(),
  subtotal: real('subtotal').notNull(),
  discount: real('discount').notNull().default(0),
  total: real('total').notNull(),
  paymentMethod: text('payment_method').notNull(),
  cashAmount: real('cash_amount'),
  cardAmount: real('card_amount'),
  changeAmount: real('change_amount').notNull().default(0),
  status: text('status').notNull().default('completed'),
  canceledAt: text('canceled_at')
}, (t) => [
  index('sales_created_at_idx').on(t.createdAt)
])

export const saleItems = sqliteTable('sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id),
  productId: integer('product_id'),
  productName: text('product_name').notNull(),
  unit: text('unit').notNull(),
  qty: real('qty').notNull(),
  unitPrice: real('unit_price').notNull(),
  unitCost: real('unit_cost').notNull().default(0),
  lineTotal: real('line_total').notNull()
}, (t) => [
  index('sale_items_sale_id_idx').on(t.saleId)
])
