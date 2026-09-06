import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cartSubtotal, computeDiscount, type DiscountType, type PaymentMethod } from '@shared/sale'
import { formatMoney, round2 } from '@shared/money'
import { unitShort } from '@shared/units'
import { useCartStore } from '@/stores/cart'
import { useSettings } from '@/hooks/useSettings'

/** Features §3.5 + §3.7 — cart lines, discount controls, totals, pay buttons. */
export function CartPanel({ onPay }: { onPay: (method: PaymentMethod) => void }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const items = useCartStore((s) => s.items)
  const discountType = useCartStore((s) => s.discountType)
  const discountValue = useCartStore((s) => s.discountValue)
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  const clear = useCartStore((s) => s.clear)
  const setDiscount = useCartStore((s) => s.setDiscount)
  const clearDiscount = useCartStore((s) => s.clearDiscount)
  const currency = settings?.general.currency ?? 'USD'

  const subtotal = round2(cartSubtotal(items.map((i) => ({ qty: i.qty, unitPrice: i.product.sellingPrice }))))
  const discountAmount = round2(computeDiscount(subtotal, { type: discountType, value: discountValue }))
  const total = round2(subtotal - discountAmount)
  const empty = items.length === 0

  const placeholder =
    discountType === 'fixed' ? '0.00' : discountType === 'percent' ? '0%' : formatMoney(subtotal, currency)

  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('pos.currentSale')}</h3>
        <Button
          variant="outline"
          size="sm"
          className="border-red-500 text-xs text-red-500 hover:bg-red-500 hover:text-white"
          onClick={clear}
        >
          {t('pos.clear')}
        </Button>
      </div>
      {empty ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('pos.emptyCart')}</p>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto">
          {items.map((i) => (
            <div key={i.product.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.product.name}</p>
                <p className="text-muted-foreground">
                  {formatMoney(i.product.sellingPrice, currency)} ×{' '}
                  <Input
                    className="mx-1 inline-flex h-7 w-16 px-1 text-center"
                    type="number"
                    min={1}
                    max={Math.max(1, i.product.stockQty)}
                    value={i.qty}
                    onChange={(e) => setQty(i.product.id, Math.floor(Number(e.target.value)))}
                  />
                  {unitShort(i.product.unit, t)}
                </p>
              </div>
              <span className="font-medium">{formatMoney(i.qty * i.product.sellingPrice, currency)}</span>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(i.product.id)}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <span>{t('pos.subtotal')}</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={discountType} onValueChange={(v) => setDiscount(v as DiscountType, discountValue)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">{t('pos.discountFixed')}</SelectItem>
              <SelectItem value="percent">{t('pos.discountPercent')}</SelectItem>
              <SelectItem value="settotal">{t('pos.discountSetTotal')}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            placeholder={placeholder}
            value={discountValue === 0 ? '' : String(discountValue)}
            onChange={(e) => {
              const v = e.target.valueAsNumber
              setDiscount(discountType, Number.isNaN(v) || v < 0 ? 0 : v)
            }}
          />
          <Button variant="ghost" size="icon" disabled={discountValue === 0} onClick={clearDiscount}>
            <X className="size-4" />
          </Button>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-destructive">
            <span>{t('pos.discount')}</span>
            <span>
              −{formatMoney(discountAmount, currency)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span>{t('pos.total')}</span>
          <span>{formatMoney(total, currency)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            disabled={empty}
            className="bg-emerald-500 text-white hover:bg-emerald-600"
            onClick={() => onPay('cash')}
          >
            {t('pos.cashPayment')}
          </Button>
          <Button
            disabled={empty}
            className="bg-blue-500 text-white hover:bg-blue-600"
            onClick={() => onPay('card')}
          >
            {t('pos.cardPayment')}
          </Button>
          <Button
            disabled={empty}
            className="bg-indigo-500 text-white hover:bg-indigo-600"
            onClick={() => onPay('split')}
          >
            {t('pos.splitPayment')}
          </Button>
        </div>
      </div>
    </div>
  )
}
