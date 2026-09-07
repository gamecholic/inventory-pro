import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { legacyWorkbookToBackup } from './legacyExcel'

function sheet(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: unknown[][]): void {
  const worksheet = workbook.addWorksheet(name)
  worksheet.addRow(headers)
  rows.forEach((row) => worksheet.addRow(row))
}

describe('legacy Excel migration', () => {
  it('maps old app sheets into the current backup contract', () => {
    const workbook = new ExcelJS.Workbook()
    sheet(workbook, 'categories', ['id', 'name', 'description', 'created_at'], [[1, 'Food', '', '2026-09-01']])
    sheet(workbook, 'suppliers', ['id', 'company_name', 'created_at', 'updated_at'], [[2, 'Supplier', '2026-09-01', '2026-09-01']])
    sheet(workbook, 'products', ['id', 'name', 'category_id', 'selling_price', 'cost_price', 'stock_quantity', 'min_stock_threshold', 'unit', 'supplier_id', 'created_at', 'updated_at', 'is_deleted'], [
      [3, 'Product', 1, 10, 6, 4, 2, 'pcs', 2, '2026-09-01', '2026-09-01', 0],
      [9, 'No History Product', 1, 20, 12, 2, 1, 'pcs', null, '2026-09-01', '2026-09-01', 0]
    ])
    sheet(workbook, 'sales', ['id', 'receipt_number', 'subtotal', 'tax_amount', 'discount_amount', 'total_amount', 'payment_method', 'cash_amount', 'card_amount', 'change_amount', 'is_returned', 'created_at', 'updated_at'], [[4, 'INV-1', 100, 0, 15, 85, 'cash', 85, 0, 0, 0, '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z']])
    sheet(workbook, 'sale_items', ['id', 'sale_id', 'product_id', 'product_name', 'quantity', 'unit_price', 'discount_amount', 'total_price', 'historical_cost_price'], [[5, 4, 3, 'Product', 1, 100, 0, 100, 6]])
    sheet(workbook, 'stock_adjustments', ['id', 'product_id', 'quantity_change', 'adjustment_type', 'reason', 'reference', 'created_at'], [
      [6, 3, -1, 'sale', 'Sold', 'INV-1', '2026-09-01T12:00:00Z'],
      [null, 999, 2, 'add', 'Orphan', 'REF-X', '2026-09-03T00:00:00Z']
    ])
    sheet(workbook, 'product_price_history', ['id', 'product_id', 'selling_price', 'cost_price', 'change_type', 'reason', 'created_at'], [
      [1, 3, 12, 7, 'both', 'Price update', '2026-09-02T12:00:00Z'],
      [null, 3, 15, 8, 'both', 'Null id price', '2026-09-03T00:00:00Z']
    ])
    sheet(workbook, 'settings', ['key', 'value', 'type'], [
      ['currency', 'try', 'string'],
      ['date_format', 'dd/mm/yyyy', 'string'],
      ['enable_notifications', 'false', 'boolean'],
      ['business_name', 'Test Store', 'string'],
      ['show_logo', 'false', 'string']
    ])
    sheet(workbook, 'expense_categories', ['id', 'name', 'description', 'created_at'], [[7, 'Rent', '', '2026-09-01']])
    sheet(workbook, 'expenses', ['id', 'reference_number', 'description', 'amount', 'category_id', 'expense_date', 'payment_method', 'created_at', 'updated_at'], [
      [8, 'REF-1', 'Rent', 50, 7, '2026-09-01', 'transfer', '2026-09-01', '2026-09-01'],
      [9, 'REF-2', 'Bank fee', 20, 7, '2026-09-02', 'bankTransfer', '2026-09-02', '2026-09-02']
    ])

    const backup = legacyWorkbookToBackup(workbook) as {
      settings: {
        general: { currency: string; dateFormat: string; lowStockNotifications: boolean }
        business: { name: string }
        receipt: { showLogo: boolean }
      }
      sales: Array<Record<string, unknown>>
      sale_items: Array<Record<string, unknown>>
      expenses: Array<Record<string, unknown>>
      stock_adjustments: Array<Record<string, unknown>>
    }

    expect(backup.settings).toMatchObject({
      general: { currency: 'TRY', dateFormat: 'DD/MM/YYYY', lowStockNotifications: false },
      business: { name: 'Test Store' },
      receipt: { showLogo: false }
    })
    expect(backup.sales[0]).toMatchObject({ receipt_no: 'INV-1', discount: 15, total: 85, status: 'completed' })
    expect(backup.sale_items[0]).toMatchObject({ sale_id: 4, product_id: 3, unit: 'pcs', unit_cost: 6 })
    expect(backup.expenses[0]).toMatchObject({ reference: 'REF-1', payment_method: 'bank' })
    expect(backup.expenses[1]).toMatchObject({ reference: 'REF-2', payment_method: 'bank' })
    expect(backup.stock_adjustments).toContainEqual(expect.objectContaining({ product_id: 3, type: 'price_both', cost_price: 7, selling_price: 12 }))
    expect(backup.stock_adjustments).toContainEqual(
      expect.objectContaining({ product_id: 3, type: 'price_both', cost_price: 8, selling_price: 15, id: null })
    )
    expect(backup.stock_adjustments).toContainEqual(expect.objectContaining({ product_id: 999, type: 'add', id: null }))
    expect(backup.stock_adjustments).toContainEqual(expect.objectContaining({ product_id: 3, type: 'initial', qty_change: 5, cost_price: 6, selling_price: 10 }))
    expect(backup.stock_adjustments).toContainEqual(expect.objectContaining({ product_id: 9, type: 'initial', qty_change: 2, cost_price: 12, selling_price: 20 }))
  })
})
