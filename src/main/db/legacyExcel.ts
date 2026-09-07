import ExcelJS from 'exceljs'
import { toISO } from '../../shared/dates'
import { EXPENSE_PAYMENTS, type ExpensePayment } from '../../shared/expenses'
import { defaultSettings, withDefaults, type SettingsValues } from '../../shared/settings'
import { replaceAll } from './backup'

const LEGACY_REQUIRED_SHEETS = ['categories', 'products', 'sales', 'sale_items', 'settings'] as const

type Row = Record<string, unknown>

function rowsFrom(sheet: ExcelJS.Worksheet | undefined): Row[] {
  if (!sheet) return []
  const header = (sheet.getRow(1).values ?? []) as unknown[]
  const rows: Row[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values = (row.values ?? []) as unknown[]
    const record: Row = {}
    for (let index = 1; index < header.length; index += 1) {
      const name = header[index]
      if (typeof name === 'string') record[name] = values[index] ?? null
    }
    if (Object.keys(record).length > 0) rows.push(record)
  })
  return rows
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value)
}

function nullableString(value: unknown): string | null {
  const result = stringValue(value).trim()
  return result === '' ? null : result
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const result = numberValue(value, Number.NaN)
  return Number.isFinite(result) ? result : null
}

function isTruthyLegacy(value: unknown): boolean {
  if (value === true) return true
  if (typeof value === 'number') return value !== 0
  return ['true', 'yes', '1'].includes(stringValue(value).trim().toLowerCase())
}

/** Coerce legacy setting values without Boolean('false') === true pitfalls. */
function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === '') return fallback
    if (['true', 'yes', '1', 'y', 'on'].includes(normalized)) return true
    if (['false', 'no', '0', 'n', 'off'].includes(normalized)) return false
  }
  return fallback
}

function isoDate(value: unknown, fallback = new Date()): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toISO(value)
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value > 100000000000 ? value : (value - 25569) * 86400000
    const date = new Date(milliseconds)
    if (!Number.isNaN(date.getTime())) return toISO(date)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const raw = value.trim()
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : new Date(raw)
    if (!Number.isNaN(date.getTime())) return toISO(date)
  }
  return toISO(fallback)
}

function legacySettingValue(row: Row): unknown {
  const value = row.value
  switch (stringValue(row.type, 'string').toLowerCase()) {
    case 'number':
      return numberValue(value, 0)
    case 'boolean':
      return isTruthyLegacy(value)
    case 'json':
      try {
        return typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        return value
      }
    default:
      return stringValue(value)
  }
}

function legacySettings(rows: Row[]): SettingsValues {
  const values = new Map(rows.map((row) => [stringValue(row.key).toLowerCase(), legacySettingValue(row)]))
  const currency = String(values.get('currency') ?? '').toUpperCase()
  const dateFormat = String(values.get('date_format') ?? '').toLowerCase()
  const settings = {
    ...defaultSettings,
    general: {
      ...defaultSettings.general,
      language: values.get('language') === 'tr' ? 'tr' : 'en',
      currency: ['USD', 'EUR', 'GBP', 'TRY'].includes(currency) ? currency : defaultSettings.general.currency,
      dateFormat:
        dateFormat === 'dd/mm/yyyy'
          ? 'DD/MM/YYYY'
          : dateFormat === 'yyyy-mm-dd'
            ? 'YYYY-MM-DD'
            : dateFormat === 'mm/dd/yyyy'
              ? 'MM/DD/YYYY'
              : defaultSettings.general.dateFormat,
      lowStockNotifications: booleanValue(values.get('enable_notifications'), defaultSettings.general.lowStockNotifications),
      cardFeePercent: numberValue(values.get('credit_card_vendor_fee'), defaultSettings.general.cardFeePercent)
    },
    business: {
      ...defaultSettings.business,
      name: stringValue(values.get('business_name')),
      address: stringValue(values.get('business_address')),
      phone: stringValue(values.get('business_phone')),
      email: stringValue(values.get('business_email')),
      taxId: stringValue(values.get('tax_id'))
    },
    receipt: {
      ...defaultSettings.receipt,
      header: stringValue(values.get('receipt_header')),
      footer: stringValue(values.get('receipt_footer'), defaultSettings.receipt.footer),
      showLogo: booleanValue(values.get('show_logo'), defaultSettings.receipt.showLogo)
    }
  }
  return withDefaults(settings)
}

function legacyPaymentMethod(value: unknown, receipt = '?'): string {
  const method = stringValue(value, 'cash').toLowerCase()
  if (method === 'cash' || method === 'card' || method === 'split') return method
  throw new Error(`Unsupported legacy payment method "${method}" for sale ${receipt} (expected cash, card or split)`)
}

/**
 * Legacy expenses store camelCase `bankTransfer` (also seen: `bank_transfer`,
 * `transfer`). Normalize to the current EXPENSE_PAYMENTS; unknown values fall
 * back to `other` so one bad row can't abort the whole migration.
 */
function legacyExpensePayment(value: unknown): ExpensePayment {
  const normalized = stringValue(value, 'cash').trim().toLowerCase().replace(/[\s_-]+/g, '')
  const mapped = normalized === 'transfer' || normalized === 'banktransfer' ? 'bank' : normalized === 'cheque' ? 'check' : normalized
  return (EXPENSE_PAYMENTS as readonly string[]).includes(mapped) ? (mapped as ExpensePayment) : 'other'
}

function cancelledAt(row: Row, fallback: Date): string | null {
  if (!isTruthyLegacy(row.is_returned)) return null
  const note = stringValue(row.notes)
  const match = note.match(/CANCELED:\s*(.+)$/i)
  return isoDate(match?.[1] ?? row.updated_at, fallback)
}

/** Convert the old app's lowercase table export into the current backup contract. */
export function legacyWorkbookToBackup(workbook: ExcelJS.Workbook, now: Date = new Date()): Record<string, unknown> {
  const missing = LEGACY_REQUIRED_SHEETS.filter((name) => !workbook.getWorksheet(name))
  if (missing.length > 0) throw new Error(`Legacy Excel file is missing sheets: ${missing.join(', ')}`)

  const categoryRows = rowsFrom(workbook.getWorksheet('categories'))
  const supplierRows = rowsFrom(workbook.getWorksheet('suppliers'))
  const productRows = rowsFrom(workbook.getWorksheet('products'))
  const salesRows = rowsFrom(workbook.getWorksheet('sales'))
  const itemRows = rowsFrom(workbook.getWorksheet('sale_items'))
  const expenseCategoryRows = rowsFrom(workbook.getWorksheet('expense_categories'))
  const expenseRows = rowsFrom(workbook.getWorksheet('expenses'))
  const adjustmentRows = rowsFrom(workbook.getWorksheet('stock_adjustments'))
  const priceHistoryRows = rowsFrom(workbook.getWorksheet('product_price_history'))
  const settingsRows = rowsFrom(workbook.getWorksheet('settings'))
  const productUnits = new Map(productRows.map((row) => [numberValue(row.id), stringValue(row.unit, 'pcs')]))
  const positiveIds = (rows: Row[]): number[] =>
    rows
      .map((row) => nullableNumber(row.id))
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
  const explicitAdjustmentIds = positiveIds(adjustmentRows)
  const explicitPriceIds = positiveIds(priceHistoryRows)
  const nullAdjustmentCount = adjustmentRows.length - explicitAdjustmentIds.length
  const nullPriceCount = priceHistoryRows.length - explicitPriceIds.length
  const maxAdjustmentId = explicitAdjustmentIds.length > 0 ? Math.max(...explicitAdjustmentIds) : 0
  const maxPriceId = explicitPriceIds.length > 0 ? Math.max(...explicitPriceIds) : 0
  // Rows without a legacy id are inserted as NULL (SQLite autoincrement).
  // Reserve that range so synthesized explicit ids can never collide with them.
  const priceIdBase = maxAdjustmentId + nullAdjustmentCount
  const baselineIdBase = priceIdBase + maxPriceId + nullPriceCount
  const movementTotals = new Map<number, number>()
  for (const row of adjustmentRows) {
    const productId = nullableNumber(row.product_id)
    if (productId === null) continue
    movementTotals.set(productId, (movementTotals.get(productId) ?? 0) + numberValue(row.quantity_change))
  }

  const data = {
    app: 'inventory-pro' as const,
    version: 3,
    exportedAt: toISO(now),
    settings: legacySettings(settingsRows),
    categories: categoryRows.map((row) => ({
      id: nullableNumber(row.id),
      name: stringValue(row.name),
      description: nullableString(row.description),
      created_at: isoDate(row.created_at, now)
    })),
    suppliers: supplierRows.map((row) => ({
      id: nullableNumber(row.id),
      company_name: stringValue(row.company_name),
      contact_person: nullableString(row.contact_person),
      phone: nullableString(row.phone),
      email: nullableString(row.email),
      address: nullableString(row.address),
      created_at: isoDate(row.created_at, now),
      updated_at: isoDate(row.updated_at ?? row.created_at, now)
    })),
    products: productRows.map((row) => ({
      id: nullableNumber(row.id),
      name: stringValue(row.name),
      barcode: nullableString(row.barcode),
      category_id: nullableNumber(row.category_id),
      unit: stringValue(row.unit, 'pcs'),
      selling_price: numberValue(row.selling_price),
      cost_price: numberValue(row.cost_price),
      stock_qty: numberValue(row.stock_quantity),
      min_stock: numberValue(row.min_stock_threshold, 5),
      supplier_id: nullableNumber(row.supplier_id),
      description: nullableString(row.description),
      archived_at: isTruthyLegacy(row.is_deleted) ? isoDate(row.deleted_at ?? row.updated_at, now) : null,
      created_at: isoDate(row.created_at, now),
      updated_at: isoDate(row.updated_at ?? row.created_at, now)
    })),
    sales: salesRows.map((row) => ({
      id: nullableNumber(row.id),
      receipt_no: stringValue(row.receipt_number, `RESTORED-${String(row.id ?? '?')}`),
      created_at: isoDate(row.created_at, now),
      subtotal: numberValue(row.subtotal),
      discount: numberValue(row.discount_amount),
      total: numberValue(row.total_amount),
      payment_method: legacyPaymentMethod(row.payment_method, stringValue(row.receipt_number, String(row.id ?? '?'))),
      cash_amount: nullableNumber(row.cash_amount),
      card_amount: nullableNumber(row.card_amount),
      change_amount: numberValue(row.change_amount),
      status: isTruthyLegacy(row.is_returned) ? 'canceled' : 'completed',
      canceled_at: cancelledAt(row, now)
    })),
    sale_items: itemRows.map((row) => ({
      id: nullableNumber(row.id),
      sale_id: nullableNumber(row.sale_id),
      product_id: nullableNumber(row.product_id),
      product_name: stringValue(row.product_name),
      unit: productUnits.get(numberValue(row.product_id)) ?? 'pcs',
      qty: numberValue(row.quantity),
      unit_price: numberValue(row.unit_price),
      unit_cost: numberValue(row.historical_cost_price),
      line_total: numberValue(row.total_price)
    })),
    expense_categories: expenseCategoryRows.map((row) => ({
      id: nullableNumber(row.id),
      name: stringValue(row.name),
      description: nullableString(row.description),
      created_at: isoDate(row.created_at, now)
    })),
    expenses: expenseRows.map((row) => ({
      id: nullableNumber(row.id),
      date: isoDate(row.expense_date, now),
      amount: numberValue(row.amount),
      description: stringValue(row.description),
      category_id: nullableNumber(row.category_id),
      payment_method: legacyExpensePayment(row.payment_method),
      recipient: nullableString(row.recipient),
      reference: nullableString(row.reference_number),
      notes: nullableString(row.notes),
      created_at: isoDate(row.created_at, now),
      updated_at: isoDate(row.updated_at ?? row.created_at, now)
    })),
    stock_adjustments: [
      ...adjustmentRows.map((row) => ({
        id: nullableNumber(row.id),
        product_id: nullableNumber(row.product_id),
        qty_change: numberValue(row.quantity_change),
        type: stringValue(row.adjustment_type),
        reason: [nullableString(row.reason), nullableString(row.reference)].filter(Boolean).join(' | '),
        cost_price: null,
        selling_price: null,
        created_at: isoDate(row.created_at, now)
      })),
      ...priceHistoryRows.map((row) => {
        const sourceId = nullableNumber(row.id)
        const legacyId = typeof sourceId === 'number' && Number.isFinite(sourceId) && sourceId > 0 ? sourceId : null
        return {
          id: legacyId === null ? null : priceIdBase + legacyId,
          product_id: nullableNumber(row.product_id),
          qty_change: 0,
          type: `price_${stringValue(row.change_type, 'change')}`,
          reason: stringValue(row.reason, 'Legacy price history'),
          cost_price: nullableNumber(row.cost_price),
          selling_price: nullableNumber(row.selling_price),
          created_at: isoDate(row.created_at, now)
        }
      }),
      ...productRows
        .map((row, index) => ({
          id: baselineIdBase + index + 1,
          product_id: nullableNumber(row.id),
          qty_change: numberValue(row.stock_quantity) - (movementTotals.get(numberValue(row.id)) ?? 0),
          type: 'initial',
          reason: 'Initial imported stock',
          cost_price: nullableNumber(row.cost_price),
          selling_price: nullableNumber(row.selling_price),
          created_at: isoDate(row.created_at, now)
        }))
    ]
  }

  return data
}

export async function readLegacyExcelBackup(filePath: string): Promise<{ categories: number; products: number }> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  return replaceAll(legacyWorkbookToBackup(workbook))
}
