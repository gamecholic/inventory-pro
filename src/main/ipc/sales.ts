import { ipcMain } from 'electron'
import { checkoutInput } from '../../shared/sale'
import { saleId, saleListFilter } from '../../shared/sales'
import { cancelSale, completeSale, getSale, listSales } from '../db/sales'

export function registerSalesIpc(): void {
  ipcMain.handle('sales:complete', (_event, input: unknown) => completeSale(checkoutInput.parse(input)))
  ipcMain.handle('sales:list', (_event, input: unknown) => listSales(saleListFilter.parse(input)))
  ipcMain.handle('sales:get', (_event, input: unknown) => getSale(saleId.parse(input).id))
  ipcMain.handle('sales:cancel', (_event, input: unknown) => cancelSale(saleId.parse(input).id))
}
