import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatMoney } from '@shared/money'
import type { RangeInput } from '@shared/analytics'
import { useFinancialMetrics } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

/** §8.1 — default report. Six metric cards plus a Metric/Value table. */
export function FinancialReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data, isPending, isError, refetch } = useFinancialMetrics(range)
  const currency = settings?.general.currency ?? 'USD'

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || (data.revenue === 0 && data.expenses === 0)) return <ReportEmpty />

  const cards: Array<[string, string]> = [
    [t('reportPage.revenue'), formatMoney(data.revenue, currency)],
    [t('reportPage.profit'), formatMoney(data.profit, currency)],
    [t('reportPage.margin'), `${data.margin.toFixed(1)}%`],
    [t('reportPage.expenses'), formatMoney(data.expenses, currency)],
    [t('reportPage.totalCash'), formatMoney(data.totalCash, currency)],
    [t('reportPage.revenueDiff'), formatMoney(data.revenueExpenseDiff, currency)]
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.financial')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.financialDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reportPage.metric')}</TableHead>
            <TableHead className="text-right">{t('reportPage.value')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map(([label, value]) => (
            <TableRow key={label}>
              <TableCell>{label}</TableCell>
              <TableCell className="text-right">{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
