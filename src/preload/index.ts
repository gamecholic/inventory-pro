import { contextBridge, ipcRenderer } from 'electron'
import type {
  CategoryInput,
  CategoryRow,
  ProductInput,
  ProductList,
  ProductListFilter,
  ProductRow,
  SupplierInput,
  SupplierRow
} from '../shared/products'
import type { PricePoint, StockAdjustInput } from '../shared/stock'
import type { CheckoutInput, Receipt } from '../shared/sale'
import type { SaleDetail, SaleList, SaleListFilter } from '../shared/sales'
import type {
  BasketPoint,
  CardFeeReport,
  CategoryProfitRow,
  DeadStockRow,
  DiscountSummary,
  ExpenseSummary,
  FinancialMetrics,
  InventoryOverview,
  InventoryValueRow,
  MonthPoint,
  PaymentRevenueRow,
  RangeInput,
  ReorderRow,
  SupplierRevenueRow,
  TopProductRow,
  TopProductsInput,
  TrendPoint,
  WeekdayPoint
} from '../shared/analytics'
import type {
  ExpenseCategoryInput,
  ExpenseCategoryRow,
  ExpenseFilter,
  ExpenseInput,
  ExpenseRow
} from '../shared/expenses'
import type { SettingsSection, SettingsValues } from '../shared/settings'

export interface ImportResult {
  filePath: string
  categories: number
  products: number
}

const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),
  settings: {
    get: (): Promise<SettingsValues> => ipcRenderer.invoke('settings:get'),
    update: (section: SettingsSection, patch: Record<string, unknown>): Promise<SettingsValues> =>
      ipcRenderer.invoke('settings:update', { section, patch })
  },
  backup: {
    exportJson: (): Promise<string | null> => ipcRenderer.invoke('backup:export-json'),
    importJson: (): Promise<ImportResult | null> => ipcRenderer.invoke('backup:import-json'),
    exportExcel: (): Promise<string | null> => ipcRenderer.invoke('backup:export-excel'),
    importExcel: (): Promise<ImportResult | null> => ipcRenderer.invoke('backup:import-excel'),
    importLegacyExcel: (): Promise<ImportResult | null> => ipcRenderer.invoke('backup:import-legacy-excel')
  },
  db: {
    reset: (): Promise<boolean> => ipcRenderer.invoke('db:reset')
  },
  products: {
    list: (filter: ProductListFilter): Promise<ProductList> => ipcRenderer.invoke('products:list', filter),
    search: (query: string, limit = 50): Promise<ProductRow[]> =>
      ipcRenderer.invoke('products:search', { query, limit }),
    create: (input: ProductInput): Promise<ProductRow> => ipcRenderer.invoke('products:create', input),
    update: (id: number, input: ProductInput): Promise<ProductRow> =>
      ipcRenderer.invoke('products:update', { ...input, id }),
    archive: (id: number): Promise<boolean> => ipcRenderer.invoke('products:archive', { id }),
    restore: (id: number): Promise<boolean> => ipcRenderer.invoke('products:restore', { id })
  },
  categories: {
    list: (): Promise<CategoryRow[]> => ipcRenderer.invoke('categories:list'),
    create: (input: CategoryInput): Promise<CategoryRow> => ipcRenderer.invoke('categories:create', input),
    update: (id: number, input: CategoryInput): Promise<CategoryRow> =>
      ipcRenderer.invoke('categories:update', { ...input, id }),
    remove: (id: number): Promise<boolean> => ipcRenderer.invoke('categories:delete', { id })
  },
  stock: {
    adjust: (input: StockAdjustInput): Promise<{ product: ProductRow; reason: string }> =>
      ipcRenderer.invoke('stock:adjust', input),
    history: (productId: number): Promise<PricePoint[]> => ipcRenderer.invoke('stock:history', { productId })
  },
  expenses: {
    list: (filter: ExpenseFilter): Promise<ExpenseRow[]> => ipcRenderer.invoke('expenses:list', filter),
    create: (input: ExpenseInput): Promise<ExpenseRow> => ipcRenderer.invoke('expenses:create', input),
    update: (id: number, input: ExpenseInput): Promise<ExpenseRow> =>
      ipcRenderer.invoke('expenses:update', { ...input, id }),
    remove: (id: number): Promise<boolean> => ipcRenderer.invoke('expenses:delete', { id })
  },
  expenseCategories: {
    list: (): Promise<ExpenseCategoryRow[]> => ipcRenderer.invoke('expense-categories:list'),
    create: (input: ExpenseCategoryInput): Promise<ExpenseCategoryRow> =>
      ipcRenderer.invoke('expense-categories:create', input),
    update: (id: number, input: ExpenseCategoryInput): Promise<ExpenseCategoryRow> =>
      ipcRenderer.invoke('expense-categories:update', { ...input, id }),
    remove: (id: number): Promise<boolean> => ipcRenderer.invoke('expense-categories:delete', { id })
  },
  sales: {
    complete: (input: CheckoutInput): Promise<Receipt> => ipcRenderer.invoke('sales:complete', input),
    list: (filter: SaleListFilter): Promise<SaleList> => ipcRenderer.invoke('sales:list', filter),
    get: (id: number): Promise<SaleDetail> => ipcRenderer.invoke('sales:get', { id }),
    cancel: (id: number): Promise<SaleDetail> => ipcRenderer.invoke('sales:cancel', { id })
  },
  analytics: {
    financial: (range: RangeInput): Promise<FinancialMetrics> => ipcRenderer.invoke('analytics:financial', range),
    topProducts: (input: TopProductsInput): Promise<TopProductRow[]> =>
      ipcRenderer.invoke('analytics:top-products', input),
    supplier: (range: RangeInput): Promise<SupplierRevenueRow[]> => ipcRenderer.invoke('analytics:supplier', range),
    payment: (range: RangeInput): Promise<PaymentRevenueRow[]> => ipcRenderer.invoke('analytics:payment', range),
    cardFees: (range: RangeInput): Promise<CardFeeReport> => ipcRenderer.invoke('analytics:card-fees', range),
    category: (range: RangeInput): Promise<CategoryProfitRow[]> => ipcRenderer.invoke('analytics:category', range),
    expenses: (range: RangeInput): Promise<ExpenseSummary> => ipcRenderer.invoke('analytics:expenses', range),
    reorder: (): Promise<ReorderRow[]> => ipcRenderer.invoke('analytics:reorder'),
    deadStock: (days: number): Promise<{ items: DeadStockRow[]; totalValue: number }> =>
      ipcRenderer.invoke('analytics:dead-stock', { days }),
    basket: (range: RangeInput): Promise<BasketPoint[]> => ipcRenderer.invoke('analytics:basket', range),
    discounts: (range: RangeInput): Promise<DiscountSummary> => ipcRenderer.invoke('analytics:discounts', range),
    monthlyExpenses: (months: number): Promise<Array<{ month: string; total: number }>> =>
      ipcRenderer.invoke('analytics:monthly-expenses', { months }),
    inventoryOverview: (): Promise<InventoryOverview> => ipcRenderer.invoke('analytics:inventory-overview'),
    inventoryValue: (by: 'supplier' | 'category'): Promise<InventoryValueRow[]> =>
      ipcRenderer.invoke('analytics:inventory-value', { by }),
    revenueTrend: (months: number): Promise<TrendPoint[]> => ipcRenderer.invoke('analytics:revenue-trend', { months }),
    weekday: (range: RangeInput): Promise<WeekdayPoint[]> => ipcRenderer.invoke('analytics:weekday', range),
    monthly: (year: number): Promise<MonthPoint[]> => ipcRenderer.invoke('analytics:monthly', { year })
  },
  suppliers: {
    list: (): Promise<SupplierRow[]> => ipcRenderer.invoke('suppliers:list'),
    create: (input: SupplierInput): Promise<SupplierRow> => ipcRenderer.invoke('suppliers:create', input),
    update: (id: number, input: SupplierInput): Promise<SupplierRow> =>
      ipcRenderer.invoke('suppliers:update', { ...input, id }),
    remove: (id: number): Promise<boolean> => ipcRenderer.invoke('suppliers:delete', { id })
  }
}

export type AppApi = typeof api

contextBridge.exposeInMainWorld('api', api)
