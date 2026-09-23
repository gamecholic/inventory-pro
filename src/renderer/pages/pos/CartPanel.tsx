import { Banknote, CreditCard, Minus, Plus, ShoppingCart, Tag, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0)

  const placeholder =
    discountType === 'fixed' ? '0.00' : discountType === 'percent' ? '0%' : formatMoney(subtotal, currency)

  const hasDiscount = discountAmount > 0
  const hasDiscountInput = discountValue !== 0 || discountType !== 'fixed'
  // Armed = user picked a discount type / typed a value, but nothing applies yet.
  // This is the pre-apply indicator: visible before computeDiscount() returns > 0.
  const isArmed = !empty && !hasDiscount && hasDiscountInput
  const setTotalNoEffect =
    !empty && !hasDiscount && discountType === 'settotal' && discountValue !== 0 && discountValue >= subtotal
  const discountRowLabel =
    discountType === 'percent'
      ? `${t('pos.discount')} (${discountValue}%)`
      : discountType === 'settotal'
        ? `${t('pos.discount')} (→ ${formatMoney(discountValue, currency)})`
        : t('pos.discount')
  const discountHelp =
    discountType === 'percent'
      ? t('pos.discountHelpPercent')
      : discountType === 'settotal'
        ? t('pos.discountHelpSetTotal')
        : t('pos.discountHelpFixed')

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      {/* Header: title + item count + clear */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ShoppingCart className="size-4" />
          </span>
          <h3 className="truncate font-semibold">{t('pos.currentSale')}</h3>
          {!empty && (
            <Badge variant="secondary" title={t('pos.itemsCount', { count: totalQty })}>
              {totalQty}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={empty}
          onClick={clear}
        >
          <Trash2 className="size-4" />
          {t('pos.clear')}
        </Button>
      </div>

      {/* Lines */}
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShoppingCart className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">{t('pos.emptyCart')}</p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2 pr-3">
            {items.map((i) => {
              const lineTotal = i.qty * i.product.sellingPrice
              const atMin = i.qty <= 1
              const atMax = i.qty >= Math.max(1, i.product.stockQty)
              const removeLabel = t('pos.removeItem', { name: i.product.name })
              return (
                <div key={i.product.id} className="rounded-lg border border-border p-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium">{i.product.name}</p>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatMoney(lineTotal, currency)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title={removeLabel}
                      aria-label={removeLabel}
                      onClick={() => remove(i.product.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {formatMoney(i.product.sellingPrice, currency)} × {unitShort(i.product.unit, t)}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label={t('pos.decreaseQty')}
                        disabled={atMin}
                        onClick={() => setQty(i.product.id, i.qty - 1)}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        className="h-6 w-14 px-1 text-center text-xs tabular-nums"
                        type="number"
                        min={1}
                        max={Math.max(1, i.product.stockQty)}
                        value={i.qty}
                        aria-label={i.product.name}
                        onChange={(e) => setQty(i.product.id, Math.floor(Number(e.target.value)))}
                      />
                      <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label={t('pos.increaseQty')}
                        disabled={atMax}
                        onClick={() => setQty(i.product.id, i.qty + 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {/* Footer: totals + discount + pay */}
      <div className="mt-auto flex flex-col gap-2.5 border-t border-border pt-3 text-sm">
        <div className="flex items-baseline justify-between text-muted-foreground">
          <span>{t('pos.subtotal')}</span>
          <span className="font-medium text-foreground tabular-nums">{formatMoney(subtotal, currency)}</span>
        </div>

        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-2.5">
          <Label
            htmlFor="pos-discount-value"
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Tag className="size-3.5" />
            {t('pos.discount')}
          </Label>
          <div className="grid grid-cols-[1.25fr_1fr_auto] items-center gap-2">
            <Select
              value={discountType}
              disabled={empty}
              onValueChange={(v) => setDiscount(v as DiscountType, discountValue)}
            >
              <SelectTrigger className="w-full" aria-label={t('pos.discount')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">{t('pos.discountFixed')}</SelectItem>
                <SelectItem value="percent">{t('pos.discountPercent')}</SelectItem>
                <SelectItem value="settotal">{t('pos.discountSetTotal')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id="pos-discount-value"
              type="number"
              min={0}
              disabled={empty}
              placeholder={placeholder}
              aria-label={t('pos.discount')}
              className="text-right tabular-nums"
              value={discountValue === 0 ? '' : String(discountValue)}
              onChange={(e) => {
                const v = e.target.valueAsNumber
                setDiscount(discountType, Number.isNaN(v) || v < 0 ? 0 : v)
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              title={t('pos.clearDiscount')}
              aria-label={t('pos.clearDiscount')}
              disabled={empty || discountValue === 0}
              onClick={clearDiscount}
            >
              <X className="size-4" />
            </Button>
          </div>
          {isArmed && (
            <p className="text-[11px] leading-snug text-muted-foreground" aria-live="polite">
              {setTotalNoEffect ? t('pos.discountHintNoEffect') : discountHelp}
            </p>
          )}
        </div>

        {hasDiscount && (
          <div className="flex items-baseline justify-between text-destructive" aria-live="polite">
            <span>{discountRowLabel}</span>
            <span className="font-medium tabular-nums">−{formatMoney(discountAmount, currency)}</span>
          </div>
        )}

        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{t('pos.total')}</span>
            <span className="text-xl font-bold tabular-nums" aria-live="polite">
              {formatMoney(total, currency)}
            </span>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-2">
          <Button
            disabled={empty}
            className="h-auto flex-col gap-1 bg-emerald-500 py-2.5 text-white hover:bg-emerald-600"
            onClick={() => onPay('cash')}
          >
            <Banknote className="size-4" />
            <span className="text-xs font-semibold">{t('pos.cashPayment')}</span>
          </Button>
          <Button
            disabled={empty}
            className="h-auto flex-col gap-1 bg-blue-500 py-2.5 text-white hover:bg-blue-600"
            onClick={() => onPay('card')}
          >
            <CreditCard className="size-4" />
            <span className="text-xs font-semibold">{t('pos.cardPayment')}</span>
          </Button>
          <Button
            disabled={empty}
            className="h-auto flex-col gap-1 bg-indigo-500 py-2.5 text-white hover:bg-indigo-600"
            onClick={() => onPay('split')}
          >
            <span className="flex items-center gap-0.5" aria-hidden="true">
              <Banknote className="size-4" />
              <Plus className="size-3" />
              <CreditCard className="size-4" />
            </span>
            <span className="text-xs font-semibold">{t('pos.splitPayment')}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
