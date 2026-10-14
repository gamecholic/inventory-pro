import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import type { AppDb, DbHandles } from './client'
import { completeSale } from './sales'

let db: AppDb
let sqlite: Database.Database
let handles: DbHandles

const now = () => new Date().toISOString()

beforeAll(() => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') })
  handles = { db, sqlite }
  db.insert(schema.settings)
    .values({ key: 'general', value: JSON.stringify({ lowStockNotifications: false }), updatedAt: now() })
    .run()
})

const makeProduct = (stockQty: number, sellingPrice: number): number =>
  db
    .insert(schema.products)
    .values({
      name: `Checkout Widget ${stockQty}@${sellingPrice}`,
      barcode: null,
      categoryId: null,
      unit: 'pcs',
      sellingPrice,
      costPrice: 8,
      stockQty,
      minStock: 5,
      supplierId: null,
      description: null,
      archivedAt: null,
      createdAt: now(),
      updatedAt: now()
    })
    .run().lastInsertRowid as number

describe('checkout payment math', () => {
  it('splits exact payment across cash and card with no change', () => {
    const id = makeProduct(10, 20)
    const receipt = completeSale(
      {
        lines: [{ productId: id, qty: 1 }],
        discount: { type: 'fixed', value: 0 },
        paymentMethod: 'split',
        cashAmount: 12,
        cardAmount: 8
      },
      handles
    )
    expect(receipt.total).toBe(20)
    expect(receipt.cashAmount).toBe(12)
    expect(receipt.cardAmount).toBe(8)
    expect(receipt.changeAmount).toBe(0)
  })

  it('rejects split payments below the total', () => {
    const id = makeProduct(10, 20)
    expect(() =>
      completeSale(
        {
          lines: [{ productId: id, qty: 1 }],
          discount: { type: 'fixed', value: 0 },
          paymentMethod: 'split',
          cashAmount: 5,
          cardAmount: 5
        },
        handles
      )
    ).toThrow('Combined payment is less than total')
  })

  it('returns change on cash overpay', () => {
    const id = makeProduct(10, 20)
    const receipt = completeSale(
      {
        lines: [{ productId: id, qty: 1 }],
        discount: { type: 'fixed', value: 0 },
        paymentMethod: 'cash',
        cashAmount: 50,
        cardAmount: null
      },
      handles
    )
    expect(receipt.cashAmount).toBe(50)
    expect(receipt.changeAmount).toBe(30)
  })

  it('rejects cash payments below the total', () => {
    const id = makeProduct(10, 20)
    expect(() =>
      completeSale(
        {
          lines: [{ productId: id, qty: 1 }],
          discount: { type: 'fixed', value: 0 },
          paymentMethod: 'cash',
          cashAmount: 5,
          cardAmount: null
        },
        handles
      )
    ).toThrow('Cash amount is less than total')
  })

  it('charges the full total on card with no cash leg', () => {
    const id = makeProduct(10, 20)
    const receipt = completeSale(
      {
        lines: [{ productId: id, qty: 2 }],
        discount: { type: 'fixed', value: 0 },
        paymentMethod: 'card',
        cashAmount: null,
        cardAmount: null
      },
      handles
    )
    expect(receipt.total).toBe(40)
    expect(receipt.cashAmount).toBeNull()
    expect(receipt.cardAmount).toBe(40)
    expect(receipt.changeAmount).toBe(0)
  })

  it('applies discounts before splitting', () => {
    const id = makeProduct(10, 20)
    const receipt = completeSale(
      {
        lines: [{ productId: id, qty: 2 }],
        discount: { type: 'percent', value: 10 },
        paymentMethod: 'split',
        cashAmount: 20,
        cardAmount: 16
      },
      handles
    )
    expect(receipt.subtotal).toBe(40)
    expect(receipt.discount).toBe(4)
    expect(receipt.total).toBe(36)
    expect(receipt.changeAmount).toBe(0)
  })
})

afterAll(() => {
  sqlite.close()
})
