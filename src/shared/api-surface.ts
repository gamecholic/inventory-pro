import type { Channel } from './api'
import type {
  CategoryInput,
  CategoryRow,
  ProductInput,
  ProductList,
  ProductListFilter,
  ProductRow,
  SupplierInput,
  SupplierRow
} from './products'
import type { PricePoint, StockAdjustInput } from './stock'
import type { CheckoutInput, Receipt } from './sale'
import type { SaleDetail, SaleList, SaleListFilter } from './sales'
import type {
  AffinityInput,
  AffinityRow,
  BasketPoint,
  CardFeeReport,
  CategoryProfitRow,
  DeadStockRow,
  DiscountSummary,
  ExpenseSummary,
  FinancialMetrics,
  HourlyPoint,
  InventoryOverview,
  InventoryValueRow,
  LowMarginInput,
  LowMarginRow,
  MonthPoint,
  PaymentRevenueRow,
  RangeInput,
  ReorderRow,
  SupplierRevenueRow,
  TopProductRow,
  TopProductsInput,
  TrendPoint,
  WeekdayPoint
} from './analytics'
import type {
  ExpenseCategoryInput,
  ExpenseCategoryRow,
  ExpenseFilter,
  ExpenseInput,
  ExpenseRow
} from './expenses'
import type { SettingsSection, SettingsValues } from './settings'
import type { UpdaterCheck, UpdaterProgress } from './updater'

export interface ImportResult {
  filePath: string
  categories: number
  products: number
}

export interface BackupDirInfo {
  custom: string
  resolved: string
}

export interface DbInfo {
  custom: string
  resolved: string
}

/**
 * Transport contract. Electron binds this to `ipcRenderer.invoke`; the Bun
 * build binds it to `fetch`. Everything below is transport-agnostic, so the
 * renderer and the server share one definition of the API.
 */
export type Invoke = <T>(channel: Channel, payload?: unknown) => Promise<T>

/**
 * The renderer-facing API. Channel names come from `shared/api.ts`; argument
 * shaping (e.g. `update(id, input)` -> `{ ...input, id }`) lives here so both
 * transports send identical payloads.
 */
export function createApi(invoke: Invoke) {
  return {
    ping: (): Promise<string> => invoke<string>('app:ping'),
    version: (): Promise<string> => invoke<string>('app:version'),
    settings: {
      get: (): Promise<SettingsValues> => invoke<SettingsValues>('settings:get'),
      update: (section: SettingsSection, patch: Record<string, unknown>): Promise<SettingsValues> =>
        invoke<SettingsValues>('settings:update', { section, patch })
    },
    backup: {
      exportJson: (): Promise<string | null> => invoke<string | null>('backup:export-json'),
      importJson: (): Promise<ImportResult | null> => invoke<ImportResult | null>('backup:import-json'),
      exportExcel: (): Promise<string | null> => invoke<string | null>('backup:export-excel'),
      importExcel: (): Promise<ImportResult | null> => invoke<ImportResult | null>('backup:import-excel'),
      importLegacyExcel: (): Promise<ImportResult | null> =>
        invoke<ImportResult | null>('backup:import-legacy-excel'),
      dir: (): Promise<BackupDirInfo> => invoke<BackupDirInfo>('backup:dir'),
      selectDir: (): Promise<string | null> => invoke<string | null>('backup:select-dir'),
      openDir: (): Promise<boolean> => invoke<boolean>('backup:open-dir')
    },
    db: {
      reset: (): Promise<boolean> => invoke<boolean>('db:reset'),
      dir: (): Promise<DbInfo> => invoke<DbInfo>('db:dir'),
      selectDir: (): Promise<string | null> => invoke<string | null>('db:select-dir'),
      setDir: (dir: string): Promise<DbInfo> => invoke<DbInfo>('db:set-dir', { dir }),
      openDir: (): Promise<boolean> => invoke<boolean>('db:open-dir')
    },
    updater: {
      check: (): Promise<UpdaterCheck> => invoke<UpdaterCheck>('updater:check'),
      download: (): Promise<UpdaterCheck> => invoke<UpdaterCheck>('updater:download'),
      progress: (): Promise<UpdaterProgress> => invoke<UpdaterProgress>('updater:progress'),
      install: (): Promise<boolean> => invoke<boolean>('updater:install')
    },
    products: {
      list: (filter: ProductListFilter): Promise<ProductList> => invoke<ProductList>('products:list', filter),
      search: (query: string, limit = 50): Promise<ProductRow[]> =>
        invoke<ProductRow[]>('products:search', { query, limit }),
      create: (input: ProductInput): Promise<ProductRow> => invoke<ProductRow>('products:create', input),
      update: (id: number, input: ProductInput): Promise<ProductRow> =>
        invoke<ProductRow>('products:update', { ...input, id }),
      archive: (id: number): Promise<boolean> => invoke<boolean>('products:archive', { id }),
      restore: (id: number): Promise<boolean> => invoke<boolean>('products:restore', { id })
    },
    categories: {
      list: (): Promise<CategoryRow[]> => invoke<CategoryRow[]>('categories:list'),
      create: (input: CategoryInput): Promise<CategoryRow> => invoke<CategoryRow>('categories:create', input),
      update: (id: number, input: CategoryInput): Promise<CategoryRow> =>
        invoke<CategoryRow>('categories:update', { ...input, id }),
      remove: (id: number): Promise<boolean> => invoke<boolean>('categories:delete', { id })
    },
    stock: {
      adjust: (input: StockAdjustInput): Promise<{ product: ProductRow; reason: string }> =>
        invoke<{ product: ProductRow; reason: string }>('stock:adjust', input),
      history: (productId: number): Promise<PricePoint[]> =>
        invoke<PricePoint[]>('stock:history', { productId })
    },
    expenses: {
      list: (filter: ExpenseFilter): Promise<ExpenseRow[]> => invoke<ExpenseRow[]>('expenses:list', filter),
      create: (input: ExpenseInput): Promise<ExpenseRow> => invoke<ExpenseRow>('expenses:create', input),
      update: (id: number, input: ExpenseInput): Promise<ExpenseRow> =>
        invoke<ExpenseRow>('expenses:update', { ...input, id }),
      remove: (id: number): Promise<boolean> => invoke<boolean>('expenses:delete', { id })
    },
    expenseCategories: {
      list: (): Promise<ExpenseCategoryRow[]> => invoke<ExpenseCategoryRow[]>('expense-categories:list'),
      create: (input: ExpenseCategoryInput): Promise<ExpenseCategoryRow> =>
        invoke<ExpenseCategoryRow>('expense-categories:create', input),
      update: (id: number, input: ExpenseCategoryInput): Promise<ExpenseCategoryRow> =>
        invoke<ExpenseCategoryRow>('expense-categories:update', { ...input, id }),
      remove: (id: number): Promise<boolean> => invoke<boolean>('expense-categories:delete', { id })
    },
    sales: {
      complete: (input: CheckoutInput): Promise<Receipt> => invoke<Receipt>('sales:complete', input),
      list: (filter: SaleListFilter): Promise<SaleList> => invoke<SaleList>('sales:list', filter),
      get: (id: number): Promise<SaleDetail> => invoke<SaleDetail>('sales:get', { id }),
      cancel: (id: number): Promise<SaleDetail> => invoke<SaleDetail>('sales:cancel', { id })
    },
    analytics: {
      financial: (range: RangeInput): Promise<FinancialMetrics> =>
        invoke<FinancialMetrics>('analytics:financial', range),
      topProducts: (input: TopProductsInput): Promise<TopProductRow[]> =>
        invoke<TopProductRow[]>('analytics:top-products', input),
      supplier: (range: RangeInput): Promise<SupplierRevenueRow[]> =>
        invoke<SupplierRevenueRow[]>('analytics:supplier', range),
      payment: (range: RangeInput): Promise<PaymentRevenueRow[]> =>
        invoke<PaymentRevenueRow[]>('analytics:payment', range),
      cardFees: (range: RangeInput): Promise<CardFeeReport> =>
        invoke<CardFeeReport>('analytics:card-fees', range),
      category: (range: RangeInput): Promise<CategoryProfitRow[]> =>
        invoke<CategoryProfitRow[]>('analytics:category', range),
      expenses: (range: RangeInput): Promise<ExpenseSummary> =>
        invoke<ExpenseSummary>('analytics:expenses', range),
      reorder: (): Promise<ReorderRow[]> => invoke<ReorderRow[]>('analytics:reorder'),
      deadStock: (days: number): Promise<{ items: DeadStockRow[]; totalValue: number }> =>
        invoke<{ items: DeadStockRow[]; totalValue: number }>('analytics:dead-stock', { days }),
      basket: (range: RangeInput): Promise<BasketPoint[]> => invoke<BasketPoint[]>('analytics:basket', range),
      discounts: (range: RangeInput): Promise<DiscountSummary> =>
        invoke<DiscountSummary>('analytics:discounts', range),
      monthlyExpenses: (months: number): Promise<Array<{ month: string; total: number }>> =>
        invoke<Array<{ month: string; total: number }>>('analytics:monthly-expenses', { months }),
      inventoryOverview: (): Promise<InventoryOverview> =>
        invoke<InventoryOverview>('analytics:inventory-overview'),
      inventoryValue: (by: 'supplier' | 'category'): Promise<InventoryValueRow[]> =>
        invoke<InventoryValueRow[]>('analytics:inventory-value', { by }),
      revenueTrend: (months: number): Promise<TrendPoint[]> =>
        invoke<TrendPoint[]>('analytics:revenue-trend', { months }),
      weekday: (range: RangeInput): Promise<WeekdayPoint[]> => invoke<WeekdayPoint[]>('analytics:weekday', range),
      monthly: (year: number): Promise<MonthPoint[]> => invoke<MonthPoint[]>('analytics:monthly', { year }),
      hourly: (range: RangeInput): Promise<HourlyPoint[]> => invoke<HourlyPoint[]>('analytics:hourly', range),
      affinity: (input: AffinityInput): Promise<AffinityRow[]> => invoke<AffinityRow[]>('analytics:affinity', input),
      lowMargin: (input: LowMarginInput): Promise<LowMarginRow[]> =>
        invoke<LowMarginRow[]>('analytics:low-margin', input)
    },
    suppliers: {
      list: (): Promise<SupplierRow[]> => invoke<SupplierRow[]>('suppliers:list'),
      create: (input: SupplierInput): Promise<SupplierRow> => invoke<SupplierRow>('suppliers:create', input),
      update: (id: number, input: SupplierInput): Promise<SupplierRow> =>
        invoke<SupplierRow>('suppliers:update', { ...input, id }),
      remove: (id: number): Promise<boolean> => invoke<boolean>('suppliers:delete', { id })
    }
  }
}

export type AppApi = ReturnType<typeof createApi>
