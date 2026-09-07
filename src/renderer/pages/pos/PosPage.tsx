import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { formatMoney } from '@shared/money'
import type { LowStockAlert, PaymentMethod, Receipt } from '@shared/sale'
import type { ProductRow } from '@shared/products'
import { useCartStore } from '@/stores/cart'
import { useSettings } from '@/hooks/useSettings'
import { usePosCatalog } from '@/hooks/usePos'
import { useCategories } from '@/hooks/useCatalog'
import { CartPanel } from './CartPanel'
import { PaymentDialog } from './PaymentDialog'
import { filterPosProducts, ProductGrid } from './ProductGrid'
import { ReceiptDialog } from './ReceiptDialog'

/** Features §3 — two-panel POS with barcode handling, payments, receipt, low-stock alerts. */
export function PosPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data: catalog } = usePosCatalog()
  const { data: categories } = useCategories()
  const add = useCartStore((s) => s.add)
  const clear = useCartStore((s) => s.clear)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [lowQueue, setLowQueue] = useState<LowStockAlert[]>([])
  const searchRef = useRef<HTMLInputElement | null>(null)
  const currency = settings?.general.currency ?? 'USD'

  // Search box is auto-focused on page open and re-focused after each sale (§3.1).
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const pick = (product: ProductRow): void => {
    const result = add(product)
    if (result === 'out') toast.error(t('pos.outOfStockMsg', { name: product.name }))
    else if (result === 'insufficient') toast.error(t('pos.insufficientMsg', { name: product.name }))
  }

  /** Features §3.3 — exact numeric barcode first, then single-result auto-add. */
  const submitSearch = (e: React.FormEvent): void => {
    e.preventDefault()
    const q = search.trim()
    if (q === '') return
    const list = catalog ?? []
    if (/^\d+$/.test(q)) {
      const exact = list.find((p) => (p.barcode ?? '') === q)
      if (exact) {
        pick(exact)
        setSearch('')
        return
      }
    }
    const filtered = filterPosProducts(list, q, categoryId)
    if (filtered.length === 1 && filtered[0]) {
      pick(filtered[0])
      setSearch('')
    }
  }

  const paid = (r: Receipt): void => {
    setPayMethod(null)
    clear()
    toast.success(t('pos.saleSuccess', { total: formatMoney(r.total, currency) }))
    setReceipt(r)
    if (r.lowStock.length > 0) setLowQueue(r.lowStock)
    searchRef.current?.focus()
  }

  const currentLow = lowQueue[0] ?? null

  return (
    <div className="absolute inset-0 top-16 flex flex-col gap-4 px-4 lg:px-6">
      <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <form onSubmit={submitSearch} className="min-h-0 lg:h-full">
          <ProductGrid
            catalog={catalog ?? []}
            categories={categories ?? []}
            search={search}
            onSearchChange={setSearch}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            onPick={pick}
            searchRef={searchRef}
          />
        </form>
        <CartPanel onPay={setPayMethod} />
      </div>

      {payMethod && (
        <PaymentDialog method={payMethod} onClose={() => setPayMethod(null)} onComplete={paid} />
      )}
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      <AlertDialog open={currentLow !== null} onOpenChange={(o) => !o && setLowQueue((q) => q.slice(1))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pos.lowStockTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {currentLow &&
                t('pos.lowStockDesc', { name: currentLow.name, qty: currentLow.stockQty, threshold: currentLow.minStock })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setLowQueue((q) => q.slice(1))}>{t('pos.lowStockOk')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
