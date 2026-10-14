import { ipcMain } from 'electron'
import {
  getAffinityPairs,
  getBasketTrend,
  getCardFeeReport,
  getCategoryProfit,
  getDeadStock,
  getDiscountSummary,
  getExpenseSummary,
  getFinancialMetrics,
  getHourlySales,
  getInventoryOverview,
  getInventoryValue,
  getLowMarginProducts,
  getMonthlyAverages,
  getMonthlyExpenses,
  getPaymentRevenue,
  getReorderSuggestions,
  getRevenueProfitTrend,
  getSupplierRevenue,
  getTopProducts,
  getWeekdayAverages
} from '../db/analytics'
import { affinityInput, deadStockInput, inventoryGroupInput, lowMarginInput, monthsInput, rangeInput, topProductsInput, yearInput } from '../../shared/analytics'

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
    return getMonthlyExpenses(monthsInput.parse(input).months)
  })
  ipcMain.handle('analytics:inventory-overview', () => getInventoryOverview())
  ipcMain.handle('analytics:inventory-value', (_event, input: unknown) => {
    return getInventoryValue(inventoryGroupInput.parse(input).by)
  })
  ipcMain.handle('analytics:revenue-trend', (_event, input: unknown) => {
    return getRevenueProfitTrend(monthsInput.parse(input).months)
  })
  ipcMain.handle('analytics:weekday', (_event, input: unknown) => getWeekdayAverages(rangeInput.parse(input)))
  ipcMain.handle('analytics:monthly', (_event, input: unknown) => getMonthlyAverages(yearInput.parse(input)))
  ipcMain.handle('analytics:hourly', (_event, input: unknown) => getHourlySales(rangeInput.parse(input)))
  ipcMain.handle('analytics:affinity', (_event, input: unknown) => getAffinityPairs(affinityInput.parse(input)))
  ipcMain.handle('analytics:low-margin', (_event, input: unknown) => getLowMarginProducts(lowMarginInput.parse(input)))
}
