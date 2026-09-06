import { ipcMain } from 'electron'
import {
  getBasketTrend,
  getCardFeeReport,
  getCategoryProfit,
  getDeadStock,
  getDiscountSummary,
  getExpenseSummary,
  getFinancialMetrics,
  getMonthlyExpenses,
  getPaymentRevenue,
  getReorderSuggestions,
  getSupplierRevenue,
  getTopProducts
} from '../db/analytics'
import { deadStockInput, rangeInput, topProductsInput } from '../../shared/analytics'

export function registerAnalyticsIpc(): void {
  ipcMain.handle('analytics:financial', (_event, input: unknown) => getFinancialMetrics(rangeInput.parse(input)))
  ipcMain.handle('analytics:top-products', (_event, input: unknown) => getTopProducts(topProductsInput.parse(input)))
  ipcMain.handle('analytics:supplier', (_event, input: unknown) => getSupplierRevenue(rangeInput.parse(input)))
  ipcMain.handle('analytics:payment', (_event, input: unknown) => getPaymentRevenue(rangeInput.parse(input)))
  ipcMain.handle('analytics:card-fees', (_event, input: unknown) => getCardFeeReport(rangeInput.parse(input)))
  ipcMain.handle('analytics:category', (_event, input: unknown) => getCategoryProfit(rangeInput.parse(input)))
  ipcMain.handle('analytics:expenses', (_event, input: unknown) => getExpenseSummary(rangeInput.parse(input)))
  ipcMain.handle('analytics:reorder', () => getReorderSuggestions())
  ipcMain.handle('analytics:dead-stock', (_event, input: unknown) => getDeadStock(deadStockInput.parse(input)))
  ipcMain.handle('analytics:basket', (_event, input: unknown) => getBasketTrend(rangeInput.parse(input)))
  ipcMain.handle('analytics:discounts', (_event, input: unknown) => getDiscountSummary(rangeInput.parse(input)))
  ipcMain.handle('analytics:monthly-expenses', (_event, input: unknown) => {
    const months = (input as { months?: unknown })?.months
    const n = typeof months === 'number' && Number.isInteger(months) && months >= 1 && months <= 24 ? months : 6
    return getMonthlyExpenses(n)
  })
}
