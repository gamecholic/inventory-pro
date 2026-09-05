import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { cartSubtotal, computeChange, computeDiscount, computeShortfall, type PaymentMethod } from '@shared/sale'
import { formatMoney, round2 } from '@shared/money'
import type { Receipt } from '@shared/sale'
import { useCartStore } from '@/stores/cart'
import { useSettings } from '@/hooks/useSettings'
import { useCompleteSale } from '@/hooks/usePos'

const num = (v: string): number | null => {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Features §3.8–§3.10. Mounted fresh per open so prefills reset.
 * Cash shortfall resolves via extra-discount confirmation before checkout.
 */
export function PaymentDialog({
  method,
  onClose,
  onComplete
}: {
  method: PaymentMethod
  onClose: () => void
  onComplete: (receipt: Receipt) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const items = useCartStore((s) => s.items)
  const discountType = useCartStore((s) => s.discountType)
  const discountValue = useCartStore((s) => s.discountValue)
  const complete = useCompleteSale(onComplete)
  const currency = settings?.general.currency ?? 'USD'

  const subtotal = round2(cartSubtotal(items.map((i) => ({ qty: i.qty, unitPrice: i.product.sellingPrice }))))
  const discountAmount = round2(computeDiscount(subtotal, { type: discountType, value: discountValue }))
  const total = round2(subtotal - discountAmount)

  const [cashStr, setCashStr] = useState(method === 'cash' ? total.toFixed(2) : '')
  const [cardStr, setCardStr] = useState(method === 'split' ? total.toFixed(2) : '')
  const [shortfallOpen, setShortfallOpen] = useState(false)

  const title = method === 'cash' ? t('pos.payCashTitle') : method === 'card' ? t('pos.payCardTitle') : t('pos.paySplitTitle')

  const lines = items.map((i) => ({ productId: i.product.id, qty: i.qty }))
  const baseDiscount = { type: discountType, value: discountValue } as const

  const checkout = (override?: {
    discountValue?: number
    cash?: number | null
    card?: number | null
  }): void => {
    complete.mutate({
      lines,
      discount: { type: override?.discountValue !== undefined ? 'fixed' : discountType, value: override?.discountValue ?? discountValue },
      paymentMethod: method,
      cashAmount: override?.cash !== undefined ? override.cash : method === 'card' ? null : (num(cashStr) ?? 0),
      cardAmount: override?.card !== undefined ? override.card : method === 'cash' ? null : (num(cardStr) ?? 0)
    })
  }

  // Cash flow (§3.9)
  const cash = num(cashStr)
  const cashChange = cash === null ? 0 : computeChange(cash, total)
  const cashShort = cash === null ? total : computeShortfall(cash, total)
  const cashBlocked = cash === null || complete.isPending

  const confirmCash = (): void => {
    if (cash === null) return
    if (cashShort > 0) {
      setShortfallOpen(true)
      return
    }
    checkout()
  }

  const confirmShortfallOk = (): void => {
    if (cash === null) return
    const extra = round2(cashShort)
    const newDiscount = round2(discountAmount + extra)
    const newTotal = round2(total - extra)
    setShortfallOpen(false)
    checkout({ discountValue: newDiscount, cash: newTotal, card: null })
  }

  // Split flow (§3.10)
  const splitCash = num(cashStr)
  const splitCard = splitCash !== null && splitCash > total ? 0 : (num(cardStr) ?? 0)
  const splitChange = splitCash === null ? 0 : computeChange(splitCash, total)
  const splitSum = (splitCash ?? 0) + splitCard - splitChange
  const splitBlocked =
    cashStr.trim() === '' || round2((splitCash ?? 0) + splitCard) < total || complete.isPending

  const onCashType = (v: string): void => {
    setCashStr(v)
    const c = num(v)
    if (c !== null) setCardStr(Math.max(0, round2(total - c)).toFixed(2))
  }

  const completeLabel = complete.isPending ? t('pos.processing') : t('pos.completeSale')

  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => {
          if (!o) onClose()
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('pos.addItemsFirst')}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between text-sm">
                <span>{t('pos.total')}</span>
                <strong>{formatMoney(total, currency)}</strong>
              </div>
              {method === 'cash' && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payCash">{t('pos.amountReceived')}</Label>
                    <Input id="payCash" type="number" min={0} step={0.01} autoFocus value={cashStr} onChange={(e) => setCashStr(e.target.value)} />
                  </div>
                  <div className="flex justify-between rounded-md bg-muted p-2 text-sm">
                    <span>{t('pos.change')}</span>
                    <span>{formatMoney(cashChange, currency)}</span>
                  </div>
                  {cashShort > 0 && (
                    <p className="text-sm text-destructive">
                      {t('pos.shortfall')}: {formatMoney(cashShort, currency)}
                    </p>
                  )}
                </>
              )}
              {method === 'card' && (
                <p className="text-sm text-muted-foreground">
                  {t('pos.total')}: {formatMoney(total, currency)}
                </p>
              )}
              {method === 'split' && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="paySplitCash">{t('pos.cashAmount')}</Label>
                    <Input id="paySplitCash" type="number" min={0} step={0.01} autoFocus value={cashStr} onChange={(e) => onCashType(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="paySplitCard">{t('pos.cardAmount')}</Label>
                    <Input
                      id="paySplitCard"
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={splitChange > 0}
                      value={splitCash !== null && splitCash > total ? '0.00' : cardStr}
                      onChange={(e) => setCardStr(e.target.value)}
                    />
                  </div>
                  {splitChange > 0 && (
                    <div className="flex justify-between rounded-md bg-muted p-2 text-sm">
                      <span>{t('pos.change')}</span>
                      <span>{formatMoney(splitChange, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between rounded-md bg-muted p-2 text-sm">
                    <span>{t('pos.totalPayment')}</span>
                    <span>{formatMoney(round2(splitSum), currency)}</span>
                  </div>
                  {round2((splitCash ?? 0) + splitCard) < total && (
                    <p className="text-sm text-destructive">{t('pos.combinedShort')}</p>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('pos.cancel')}
            </Button>
            <Button
              disabled={method === 'cash' ? cashBlocked : method === 'split' ? splitBlocked : complete.isPending}
              onClick={() => {
                if (method === 'cash') confirmCash()
                else checkout()
              }}
            >
              {completeLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={shortfallOpen} onOpenChange={setShortfallOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pos.shortfallTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pos.shortfallDesc', { amount: formatMoney(cashShort, currency) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('pos.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmShortfallOk}>{t('settings.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
