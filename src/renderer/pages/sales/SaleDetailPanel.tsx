import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
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
import { formatMoney } from '@shared/money'
import { formatISO } from '@shared/dates'
import { unitShort } from '@shared/units'
import type { SaleDetail } from '@shared/sales'
import type { Receipt } from '@shared/sale'
import { ReceiptDialog } from '@/pages/pos/ReceiptDialog'
import { useCancelSale, useSale } from '@/hooks/useSales'
import { useSettings } from '@/hooks/useSettings'

function toReceipt(detail: SaleDetail): Receipt {
  return {
    receiptNo: detail.receiptNo,
    createdAt: detail.createdAt,
    lines: detail.items.map((i) => ({
      productName: i.productName ?? '',
      qty: i.qty,
      unit: i.unit,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal
    })),
    subtotal: detail.subtotal,
    discount: detail.discount,
    total: detail.total,
    paymentMethod: detail.paymentMethod as Receipt['paymentMethod'],
    cashAmount: detail.cashAmount,
    cardAmount: detail.cardAmount,
    changeAmount: detail.changeAmount,
    lowStock: []
  }
}

/** Features §6.3–§6.6 — receipt-style detail with reprint, disabled return, cancel. */
export function SaleDetailPanel({
  saleId,
  onClose
}: {
  saleId: number | null
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data: detail } = useSale(saleId)
  const cancel = useCancelSale()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [print, setPrint] = useState(false)
  const currency = settings?.general.currency ?? 'USD'
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'
  const business = settings?.business
  const canceled = detail?.status === 'canceled'

  return (
    <>
      <Sheet
        open={saleId !== null}
        onOpenChange={(o) => {
          if (!o) onClose()
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('sales.saleDetails')}</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1 border-b border-border pb-3">
                {business?.name !== '' && <p className="text-base font-bold">{business?.name}</p>}
                {business?.address !== '' && <p className="whitespace-pre-line text-muted-foreground">{business?.address}</p>}
                {business?.phone !== '' && (
                  <p className="text-muted-foreground">
                    {t('pos.receipt.phone')}: {business?.phone}
                  </p>
                )}
                {business?.email !== '' && (
                  <p className="text-muted-foreground">
                    {t('pos.receipt.email')}: {business?.email}
                  </p>
                )}
                <p className="mt-1">
                  {formatISO(detail.createdAt, dateFormat)} · {detail.receiptNo}
                </p>
                {canceled && <p className="font-bold text-destructive">{t('sales.canceled')}</p>}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1 font-medium">{t('pos.receipt.items')}</th>
                    <th className="py-1 font-medium">{t('pos.receipt.qty')}</th>
                    <th className="py-1 text-right font-medium">{t('pos.receipt.price')}</th>
                    <th className="py-1 text-right font-medium">{t('pos.receipt.receiptTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i, n) => (
                    <tr key={n} className="border-b border-border/50">
                      <td className="py-1">{i.productName ?? t('sales.unknownProduct')}</td>
                      <td className="py-1">
                        {i.qty} {unitShort(i.unit, t)}
                      </td>
                      <td className="py-1 text-right">{formatMoney(i.unitPrice, currency)}</td>
                      <td className="py-1 text-right">{formatMoney(i.lineTotal, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between">
                <span>{t('pos.subtotal')}</span>
                <span>{formatMoney(detail.subtotal, currency)}</span>
              </div>
              {detail.discount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>{t('pos.discount')}</span>
                  <span>−{formatMoney(detail.discount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>{t('pos.total')}</span>
                <span>{formatMoney(detail.total, currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span>{t('pos.receipt.paymentMethod')}</span>
                <span>
                  {detail.paymentMethod === 'cash'
                    ? t('pos.receipt.cash')
                    : detail.paymentMethod === 'card'
                      ? t('pos.receipt.card')
                      : t('pos.receipt.split')}
                </span>
              </div>
              {detail.changeAmount > 0 && (
                <div className="flex justify-between">
                  <span>{t('pos.change')}</span>
                  <span>{formatMoney(detail.changeAmount, currency)}</span>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPrint(true)}>
                  {t('pos.receipt.print')}
                </Button>
                <Button variant="outline" disabled title={t('sales.returnDisabled')}>
                  {t('sales.processReturn')}
                </Button>
                {!canceled && (
                  <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                    {t('sales.cancelSale')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sales.cancelSaleTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {detail && t('sales.cancelSaleDesc', { receipt: detail.receiptNo, date: formatISO(detail.createdAt, dateFormat) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('pos.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (detail) cancel.mutate(detail.id, { onSuccess: () => setConfirmCancel(false) })
              }}
            >
              {t('settings.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReceiptDialog receipt={print && detail ? toReceipt(detail) : null} onClose={() => setPrint(false)} />
    </>
  )
}
