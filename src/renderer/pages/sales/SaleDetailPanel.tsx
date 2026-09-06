import { useState } from 'react'
import { Ban, Printer, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
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
            <SheetTitle className="flex items-center gap-2">
              {t('sales.saleDetails')}
              {detail && (
                <Badge variant={canceled ? 'destructive' : 'secondary'}>
                  {canceled ? t('sales.canceled') : t('sales.completed')}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 p-4">
                {business?.name !== '' && <p className="text-base font-bold">{business?.name}</p>}
                {business?.address !== '' && (
                  <p className="whitespace-pre-line text-muted-foreground">{business?.address}</p>
                )}
                {(business?.phone !== '' || business?.email !== '') && (
                  <p className="text-muted-foreground">
                    {[business?.phone, business?.email].filter((v) => v !== '').join(' · ')}
                  </p>
                )}
                <p className="mt-2 font-mono text-xs text-muted-foreground">{detail.receiptNo}</p>
                <p className="text-xs text-muted-foreground">{formatISO(detail.createdAt, dateFormat)}</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('pos.receipt.items')}</TableHead>
                    <TableHead>{t('pos.receipt.qty')}</TableHead>
                    <TableHead className="text-right">{t('pos.receipt.price')}</TableHead>
                    <TableHead className="text-right">{t('pos.receipt.receiptTotal')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.items.map((i, n) => (
                    <TableRow key={n}>
                      <TableCell className="font-medium">{i.productName ?? t('sales.unknownProduct')}</TableCell>
                      <TableCell>
                        {i.qty} {unitShort(i.unit, t)}
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(i.unitPrice, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(i.lineTotal, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-4">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('pos.subtotal')}</span>
                  <span>{formatMoney(detail.subtotal, currency)}</span>
                </div>
                {detail.discount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>{t('pos.discount')}</span>
                    <span>−{formatMoney(detail.discount, currency)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{t('pos.total')}</span>
                  <span className="text-xl font-bold">{formatMoney(detail.total, currency)}</span>
                </div>
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>{t('pos.receipt.paymentMethod')}</span>
                  <span className="text-foreground">
                    {detail.paymentMethod === 'cash'
                      ? t('pos.receipt.cash')
                      : detail.paymentMethod === 'card'
                        ? t('pos.receipt.card')
                        : t('pos.receipt.split')}
                  </span>
                </div>
                {detail.changeAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('pos.change')}</span>
                    <span>{formatMoney(detail.changeAmount, currency)}</span>
                  </div>
                )}
                {detail.paymentMethod === 'split' && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('pos.cashAmount')}</span>
                      <span>{formatMoney(detail.cashAmount ?? 0, currency)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('pos.cardAmount')}</span>
                      <span>{formatMoney(detail.cardAmount ?? 0, currency)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setPrint(true)}>
                  <Printer className="size-4" />
                  {t('pos.receipt.print')}
                </Button>
                <Button variant="outline" disabled title={t('sales.returnDisabled')}>
                  <Undo2 className="size-4" />
                  {t('sales.processReturn')}
                </Button>
                {!canceled && (
                  <Button variant="destructive" className="col-span-2" onClick={() => setConfirmCancel(true)}>
                    <Ban className="size-4" />
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

      <ReceiptDialog receipt={print && detail ? toReceipt(detail) : null} onClose={() => setPrint(false)} showTime />
    </>
  )
}
