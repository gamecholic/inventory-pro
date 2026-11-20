import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, X } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatMoney, round2 } from '@shared/money'
import { cartSubtotal, computeDiscount } from '@shared/sale'
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
  const items = useCartStore((s) => s.items)
  const discountType = useCartStore((s) => s.discountType)
  const discountValue = useCartStore((s) => s.discountValue)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [lowQueue, setLowQueue] = useState<LowStockAlert[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const currency = settings?.general.currency ?? 'USD'
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0)
  const subtotal = round2(cartSubtotal(items.map((i) => ({ qty: i.qty, unitPrice: i.product.sellingPrice }))))
  const cartTotal = round2(subtotal - computeDiscount(subtotal, { type: discountType, value: discountValue }))

  // Search box is auto-focused on page open and re-focused after each sale (§3.1).
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Stable identity keeps memoized ProductCards from re-rendering on every keystroke.
  const pick = useCallback(
    (product: ProductRow): void => {
      const result = add(product)
      if (result === 'out') toast.error(t('pos.outOfStockMsg', { name: product.name }))
      else if (result === 'insufficient') toast.error(t('pos.insufficientMsg', { name: product.name }))
    },
    [add, t]
  )

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

  // Below lg the panels stack in one column: the grid takes the remaining
  // height and keeps its own bounded scroller (the virtualizer needs it), with
  // the cart bar pinned underneath. At lg+ each panel scrolls internally.
  return (
    <div className="absolute inset-0 top-16 flex flex-col gap-4 overflow-hidden px-4 pb-4 lg:px-6 lg:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:items-start lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem]">
        <form onSubmit={submitSearch} className="flex min-h-0 flex-1 flex-col lg:h-full">
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
        <div className="hidden lg:block">
          <CartPanel onPay={setPayMethod} />
        </div>
      </div>

      <div data-testid="pos-cart-bar" className="sticky bottom-0 z-30 -mx-4 shrink-0 border-t border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
        <Button className="h-11 w-full justify-between gap-2 lg:h-9" onClick={() => setCartOpen(true)} aria-label={t('pos.currentSale')}>
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-5 lg:size-4" />
            {t('pos.currentSale')}
            {totalQty > 0 && <Badge variant="secondary">{totalQty}</Badge>}
          </span>
          <span className="tabular-nums">{formatMoney(cartTotal, currency)}</span>
        </Button>
      </div>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="flex h-[85dvh] flex-col gap-0 p-0">
          <SheetHeader className="flex-row items-center justify-between border-b px-4 py-3">
            <SheetTitle>{t('pos.currentSale')}</SheetTitle>
            {/* In-flow close button: the default absolute one overlaps this compact header on mobile. */}
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="-mr-2 size-11" aria-label={t('pos.close')}>
                <X className="size-5" />
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col p-3 [&>div]:min-h-0 [&>div]:flex-1">
            <CartPanel
              onPay={(m) => {
                setCartOpen(false)
                setPayMethod(m)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

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
