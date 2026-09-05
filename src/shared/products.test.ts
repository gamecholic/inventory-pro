import { describe, expect, it } from 'vitest'
import { categoryInput, productInput, stockStatus, supplierInput } from './products'

describe('stockStatus', () => {
  it('is out at zero and below', () => {
    expect(stockStatus(0, 5)).toBe('out')
    expect(stockStatus(-2, 5)).toBe('out')
  })

  it('is low within threshold (inclusive)', () => {
    expect(stockStatus(1, 5)).toBe('low')
    expect(stockStatus(5, 5)).toBe('low')
  })

  it('is in above threshold', () => {
    expect(stockStatus(6, 5)).toBe('in')
  })
})

describe('productInput', () => {
  const valid = {
    name: 'Test Product',
    categoryId: 1,
    sellingPrice: 25,
    costPrice: 10
  }

  it('fills defaults for optional fields', () => {
    const parsed = productInput.parse(valid)
    expect(parsed.unit).toBe('pcs')
    expect(parsed.stockQty).toBe(0)
    expect(parsed.minStock).toBe(5)
    expect(parsed.supplierId).toBeNull()
  })

  it('rejects missing name, category and negative prices', () => {
    expect(productInput.safeParse({ ...valid, name: '  ' }).success).toBe(false)
    expect(productInput.safeParse({ ...valid, categoryId: 0 }).success).toBe(false)
    expect(productInput.safeParse({ ...valid, sellingPrice: -1 }).success).toBe(false)
    expect(productInput.safeParse({ ...valid, stockQty: -1 }).success).toBe(false)
  })
})

describe('categoryInput / supplierInput', () => {
  it('requires names', () => {
    expect(categoryInput.safeParse({ name: '' }).success).toBe(false)
    expect(supplierInput.safeParse({ companyName: '' }).success).toBe(false)
    expect(supplierInput.safeParse({ companyName: 'Acme' }).success).toBe(true)
  })

  it('rejects invalid supplier email', () => {
    expect(supplierInput.safeParse({ companyName: 'Acme', email: 'nope' }).success).toBe(false)
  })
})
