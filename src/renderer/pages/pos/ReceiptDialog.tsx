import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { formatMoney } from '@shared/money'
import { formatISO } from '@shared/dates'
import { unitShort } from '@shared/units'
import type { Receipt } from '@shared/sale'
import { useSettings } from '@/hooks/useSettings'

/** Features §3.11 — receipt dialog shared with reprint. Prints via window.print + print CSS. */
export function ReceiptDialog({
  receipt,
  onClose
}: {
  receipt: Receipt | null
  onClose: () => void
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  if (!receipt) return null

  const currency = settings?.general.currency ?? 'USD'
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'
  const business = settings?.business ?? { name: '', address: '', phone: '', email: '', taxId: '' }
  const receiptCfg = settings?.receipt ?? { header: '', footer: 'Thank you for your purchase!', showLogo: false }
  const methodLabel =
    receipt.paymentMethod === 'cash'
      ? t('pos.receipt.cash')
      : receipt.paymentMethod === 'card'
        ? t('pos.receipt.card')
        : t('pos.receipt.split')

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <div id="receipt-print" className="flex flex-col gap-2 text-sm">
          <DialogHeader>
            <DialogTitle>
              {t('pos.receipt.receiptTotal')}: {receipt.receiptNo}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">{formatISO(receipt.createdAt, dateFormat)}</p>
          {business.name !== '' && <p className="text-base font-bold">{business.name}</p>}
          {business.address !== '' && <p className="whitespace-pre-line">{business.address}</p>}
          {business.phone !== '' && (
            <p>
              {t('pos.receipt.phone')}: {business.phone}
            </p>
          )}
          {business.email !== '' && (
            <p>
              {t('pos.receipt.email')}: {business.email}
            </p>
          )}
          {receiptCfg.header !== '' && <p className="whitespace-pre-line">{receiptCfg.header}</p>}
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
              {receipt.lines.map((l, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1">{l.productName}</td>
                  <td className="py-1">
                    {l.qty} {unitShort(l.unit, t)}
                  </td>
                  <td className="py-1 text-right">{formatMoney(l.unitPrice, currency)}</td>
                  <td className="py-1 text-right">{formatMoney(l.lineTotal, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between">
            <span>{t('pos.subtotal')}</span>
            <span>{formatMoney(receipt.subtotal, currency)}</span>
          </div>
          {receipt.discount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>{t('pos.discount')}</span>
              <span>−{formatMoney(receipt.discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>{t('pos.total')}</span>
            <span>{formatMoney(receipt.total, currency)}</span>
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <div className="flex justify-between">
              <span>{t('pos.receipt.paymentMethod')}</span>
              <span>{methodLabel}</span>
            </div>
            {receipt.paymentMethod === 'cash' && (
              <>
                <div className="flex justify-between">
                  <span>{t('pos.amountReceived')}</span>
                  <span>{formatMoney(receipt.cashAmount ?? 0, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pos.change')}</span>
                  <span>{formatMoney(receipt.changeAmount, currency)}</span>
                </div>
              </>
            )}
            {receipt.paymentMethod === 'split' && (
              <>
                <div className="flex justify-between">
                  <span>{t('pos.cashAmount')}</span>
                  <span>{formatMoney(receipt.cashAmount ?? 0, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pos.cardAmount')}</span>
                  <span>{formatMoney(receipt.cardAmount ?? 0, currency)}</span>
                </div>
                {receipt.changeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>{t('pos.change')}</span>
                    <span>{formatMoney(receipt.changeAmount, currency)}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="pt-2 text-center text-muted-foreground">{receiptCfg.footer}</p>
        </div>
        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={onClose}>
            {t('pos.receipt.close')}
          </Button>
          <Button onClick={() => window.print()}>{t('pos.receipt.print')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
