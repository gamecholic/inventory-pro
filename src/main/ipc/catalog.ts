import { ipcMain } from 'electron'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../db/categories'
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier } from '../db/suppliers'
import {
  archiveProduct,
  createProduct,
  listProducts,
  restoreProduct,
  searchProducts,
  updateProduct
} from '../db/products'
import { adjustStock } from '../db/stock'
import { stockAdjustInput } from '../../shared/stock'
import {
  categoryInput,
  productId,
  productInput,
  productListFilter,
  productSearchInput,
  supplierInput,
  updateCategoryInput,
  updateProductInput,
  updateSupplierInput
} from '../../shared/products'
import { idInput } from '../../shared/api'

export function registerCatalogIpc(): void {
  ipcMain.handle('products:list', (_event, input: unknown) => listProducts(productListFilter.parse(input)))
  ipcMain.handle('products:create', (_event, input: unknown) => createProduct(productInput.parse(input)))
  ipcMain.handle('products:update', (_event, input: unknown) => {
    const { id, ...patch } = updateProductInput.parse(input)
    return updateProduct(id, productInput.parse(patch))
  })
  ipcMain.handle('products:archive', (_event, input: unknown) => {
    archiveProduct(productId.parse(input).id)
    return true
  })
  ipcMain.handle('products:restore', (_event, input: unknown) => {
    restoreProduct(productId.parse(input).id)
    return true
  })
  ipcMain.handle('products:search', (_event, input: unknown) => {
    const { query, limit } = productSearchInput.parse(input)
    return searchProducts(query, limit)
  })
  ipcMain.handle('stock:adjust', (_event, input: unknown) => adjustStock(stockAdjustInput.parse(input)))

  ipcMain.handle('categories:list', () => listCategories())
  ipcMain.handle('categories:create', (_event, input: unknown) => createCategory(categoryInput.parse(input)))
  ipcMain.handle('categories:update', (_event, input: unknown) => {
    const { id, ...patch } = updateCategoryInput.parse(input)
    return updateCategory(id, categoryInput.parse(patch))
  })
  ipcMain.handle('categories:delete', (_event, input: unknown) => {
    deleteCategory(idInput.parse(input).id)
    return true
  })

  ipcMain.handle('suppliers:list', () => listSuppliers())
  ipcMain.handle('suppliers:create', (_event, input: unknown) => createSupplier(supplierInput.parse(input)))
  ipcMain.handle('suppliers:update', (_event, input: unknown) => {
    const { id, ...patch } = updateSupplierInput.parse(input)
    return updateSupplier(id, supplierInput.parse(patch))
  })
  ipcMain.handle('suppliers:delete', (_event, input: unknown) => {
    deleteSupplier(idInput.parse(input).id)
    return true
  })
}
