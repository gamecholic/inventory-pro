import { ipcMain } from 'electron'
import { checkoutInput } from '../../shared/sale'
import { completeSale } from '../db/sales'

export function registerSalesIpc(): void {
  ipcMain.handle('sales:complete', (_event, input: unknown) => completeSale(checkoutInput.parse(input)))
}
