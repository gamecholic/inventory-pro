import ExcelJS from 'exceljs'
import { toISO } from '../../shared/dates'
import { BACKUP_VERSION, collectAll, replaceAll } from './backup'

const PRODUCT_COLUMNS = [
  'id',
  'name',
  'barcode',
  'category_id',
  'unit',
  'selling_price',
  'cost_price',
  'stock_qty',
  'min_stock',
  'supplier_id',
  'description',
  'archived_at',
  'created_at',
  'updated_at'
] as const

const SALE_COLUMNS = [
  'id',
  'receipt_no',
  'created_at',
  'subtotal',
  'discount',
  'total',
  'payment_method',
  'cash_amount',
  'card_amount',
  'change_amount',
  'status',
  'canceled_at'
] as const

const ITEM_COLUMNS = ['id', 'sale_id', 'product_id', 'product_name', 'unit', 'qty', 'unit_price', 'line_total'] as const

/** One workbook, one sheet per table. First row is the header. */
export async function writeExcelBackup(filePath: string): Promise<void> {
  const dump = collectAll()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Inventory Pro'
  wb.created = new Date()
  const settingsSheet = wb.addWorksheet('Settings')
  settingsSheet.columns = [
    { header: 'key', key: 'key', width: 20 },
    { header: 'value', key: 'value', width: 80 }
  ]
  for (const [key, value] of Object.entries(dump.settings)) {
    settingsSheet.addRow({ key, value: JSON.stringify(value) })
  }
  const catSheet = wb.addWorksheet('Categories')
  catSheet.columns = [
    { header: 'id', key: 'id', width: 8 },
    { header: 'name', key: 'name', width: 30 },
    { header: 'description', key: 'description', width: 50 },
    { header: 'created_at', key: 'created_at', width: 28 }
  ]
  for (const c of dump.categories) catSheet.addRow(c)
  const prodSheet = wb.addWorksheet('Products')
  prodSheet.columns = PRODUCT_COLUMNS.map((h) => ({ header: h, key: h, width: h === 'name' ? 30 : 16 }))
  for (const p of dump.products) prodSheet.addRow({ ...p })
  const salesSheet = wb.addWorksheet('Sales')
  salesSheet.columns = SALE_COLUMNS.map((h) => ({ header: h, key: h, width: 18 }))
  for (const s of dump.sales) salesSheet.addRow({ ...s })
  const itemsSheet = wb.addWorksheet('SaleItems')
  itemsSheet.columns = ITEM_COLUMNS.map((h) => ({ header: h, key: h, width: 16 }))
  for (const i of dump.sale_items) itemsSheet.addRow({ ...i })
  await wb.xlsx.writeFile(filePath)
}

/** Read a workbook written by writeExcelBackup and replace all data. */
export async function readExcelBackup(filePath: string): Promise<{ categories: number; products: number }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const getSheet = (name: string): ExcelJS.Worksheet => {
    const sheet = wb.getWorksheet(name)
    if (!sheet) throw new Error(`Missing sheet: ${name}`)
    return sheet
  }
  // Sales sheets are absent in v1 backups — treat as empty, keep them importable.
  const optSheet = (name: string): ExcelJS.Worksheet | null => wb.getWorksheet(name) ?? null
  const settingsObj: Record<string, unknown> = {}
  getSheet('Settings').eachRow((row, n) => {
    if (n === 1) return
    const key = String(row.getCell(1).value ?? '')
    const raw = row.getCell(2).value
    if (key) {
      try {
        settingsObj[key] = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
      } catch {
        settingsObj[key] = undefined
      }
    }
  })
  const readRows = (sheet: ExcelJS.Worksheet): Array<Record<string, unknown>> => {
    const header = (sheet.getRow(1).values ?? []) as unknown[]
    const rows: Array<Record<string, unknown>> = []
    sheet.eachRow((row, n) => {
      if (n === 1) return
      const values = (row.values ?? []) as unknown[]
      const rec: Record<string, unknown> = {}
      for (let i = 1; i < header.length; i++) {
        const name = header[i]
        if (typeof name === 'string') rec[name] = values[i] ?? null
      }
      rows.push(rec)
    })
    return rows
  }
  const salesSheet = optSheet('Sales')
  const itemsSheet = optSheet('SaleItems')
  return replaceAll({
    app: 'inventory-pro',
    version: BACKUP_VERSION,
    exportedAt: toISO(new Date()),
    settings: settingsObj,
    categories: readRows(getSheet('Categories')),
    products: readRows(getSheet('Products')),
    sales: salesSheet ? readRows(salesSheet) : [],
    sale_items: itemsSheet ? readRows(itemsSheet) : []
  })
}
