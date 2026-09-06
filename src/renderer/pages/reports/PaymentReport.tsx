import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatMoney, round2 } from '@shared/money'
import type { RangeInput } from '@shared/analytics'
import { usePaymentReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

const METHOD_KEY: Record<string, string> = {
  cash: 'pos.receipt.cash',
  card: 'pos.receipt.card',
  split: 'pos.receipt.split'
}

/** §8.3 — table only, with net-card row and Total footer. */
export function PaymentReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data, isPending, isError, refetch } = usePaymentReport(range)
  const currency = settings?.general.currency ?? 'USD'
  const feePercent = settings?.general.cardFeePercent ?? 0

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <ReportEmpty />

  const total = round2(data.reduce((s, r) => s + r.revenue, 0))
  const card = data.find((r) => r.method === 'card')
  const netCard = card ? round2(card.revenue - (card.revenue * feePercent) / 100) : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.payment')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.paymentDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reportPage.method')}</TableHead>
            <TableHead className="text-right">{t('reportPage.revenue')}</TableHead>
            <TableHead className="text-right">{t('reportPage.share')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.method}>
              <TableCell>{t(METHOD_KEY[r.method] ?? 'pos.receipt.split', { defaultValue: r.method })}</TableCell>
              <TableCell className="text-right">{formatMoney(r.revenue, currency)}</TableCell>
              <TableCell className="text-right">{r.share.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
          {netCard !== null && (
            <TableRow>
              <TableCell className="italic">
                {t('reportPage.netCard')} ({feePercent}%)
              </TableCell>
              <TableCell className="text-right italic">{formatMoney(netCard, currency)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{t('reportPage.total')}</TableCell>
            <TableCell className="text-right">{formatMoney(total, currency)}</TableCell>
            <TableCell className="text-right">100%</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
