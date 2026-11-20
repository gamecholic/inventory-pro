/**
 * End-to-end HTTP contract tests for the Bun server.
 *
 * Unit tests in src/main/db/* exercise repositories directly; these tests go
 * through POST /api/<channel> exactly like the renderer does, so they catch
 * broken channel wiring, Zod validation, error status codes and transaction
 * regressions without starting a browser. Runs with `npm run test:bun`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startServer, type RunningServer } from '../../server/index'
import { closeDb } from '../main/db/client'
import { showNativeDialog } from '../../server/dialogs'

let server: RunningServer
let baseUrl: string
let dataDir: string
const previousDataDir = process.env.INVENTORY_DATA_DIR
const previousDialogResponse = process.env.INVENTORY_TEST_DIALOG_RESPONSE

interface ApiResponse<T = unknown> {
  status: number
  body: T
  text: string
}

async function post<T = unknown>(channel: string, payload?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${baseUrl}/api/${encodeURIComponent(channel)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload })
  })
  const text = await response.text()
  let body: T
  try {
    body = JSON.parse(text) as T
  } catch {
    body = undefined as T
  }
  return { status: response.status, body, text }
}

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'inventory-pro-api-test-'))
  process.env.INVENTORY_DATA_DIR = dataDir
  process.env.INVENTORY_DRIZZLE_DIR = join(process.cwd(), 'drizzle')
  delete process.env.INVENTORY_TEST_DIALOG_RESPONSE
  server = startServer({ port: 0, webRoot: join(process.cwd(), 'out', 'web') })
  baseUrl = `http://127.0.0.1:${server.port}`
})

afterAll(() => {
  server?.stop()
  closeDb()
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // ignore
  }
  if (previousDataDir === undefined) delete process.env.INVENTORY_DATA_DIR
  else process.env.INVENTORY_DATA_DIR = previousDataDir
  if (previousDialogResponse === undefined) delete process.env.INVENTORY_TEST_DIALOG_RESPONSE
  else process.env.INVENTORY_TEST_DIALOG_RESPONSE = previousDialogResponse
})

describe('HTTP transport', () => {
  it('answers health and trivial channels', async () => {
    const health = await fetch(`${baseUrl}/api/health`)
    expect(health.status).toBe(200)
    expect(await health.json()).toMatchObject({ ok: true })

    expect((await post<string>('app:ping')).body).toBe('pong')
    expect(typeof (await post<string>('app:version')).body).toBe('string')
  })

  it('rejects unknown channels (404), wrong methods (405) and invalid payloads (400)', async () => {
    expect((await post('no-such:channel')).status).toBe(404)

    const wrongMethod = await fetch(`${baseUrl}/api/app:ping`)
    expect(wrongMethod.status).toBe(405)

    const invalid = await post('categories:create', { name: '', description: '' })
    expect(invalid.status).toBe(400)
    expect(invalid.text.length).toBeGreaterThan(0)
  })
})

describe('catalog → sale flow', () => {
  let productId = 0

  it('creates a category and a product over the API', async () => {
    const category = await post<{ id: number }>('categories:create', {
      name: 'API Test Category',
      description: ''
    })
    expect(category.status).toBe(200)
    expect(category.body.id).toBeGreaterThan(0)

    const product = await post<{ id: number; name: string; stockQty: number }>('products:create', {
      name: 'API Test Ürün',
      barcode: 'API-001',
      categoryId: category.body.id,
      unit: 'pcs',
      sellingPrice: 25,
      costPrice: 10,
      stockQty: 10,
      minStock: 5,
      supplierId: null,
      description: ''
    })
    expect(product.status).toBe(200)
    productId = product.body.id
    expect(product.body.name).toBe('API Test Ürün')
    expect(product.body.stockQty).toBe(10)
  })

  it('searches with Turkish-normalized text', async () => {
    const result = await post<Array<{ id: number; name: string }>>('products:search', {
      query: 'URUN',
      limit: 10
    })
    expect(result.status).toBe(200)
    expect(result.body.some((row) => row.id === productId)).toBe(true)
  })

  it('completes a sale in one transaction and decrements stock', async () => {
    const receipt = await post<{ receiptNo: string; total: number }>('sales:complete', {
      lines: [{ productId, qty: 2 }],
      discount: { type: 'fixed', value: 0 },
      paymentMethod: 'cash',
      cashAmount: 50,
      cardAmount: null
    })
    expect(receipt.status).toBe(200)
    expect(receipt.body.receiptNo).toMatch(/^INV-\d{8}-\d{6}$/)
    expect(receipt.body.total).toBe(50)

    const search = await post<Array<{ id: number; stockQty: number }>>('products:search', {
      query: 'API-001',
      limit: 10
    })
    expect(search.body.find((row) => row.id === productId)?.stockQty).toBe(8)
  })
})

describe('headless test hooks', () => {
  it('returns a canned path from showNativeDialog when the env override is set', async () => {
    process.env.INVENTORY_TEST_DIALOG_RESPONSE = 'C:\\test\\backup.xlsx'
    expect(await showNativeDialog({ kind: 'save', title: 'Test' })).toBe('C:\\test\\backup.xlsx')

    process.env.INVENTORY_TEST_DIALOG_RESPONSE = ''
    expect(await showNativeDialog({ kind: 'open', title: 'Test' })).toBeNull()
  })
})
