import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Cell, Legend, Pie, PieChart } from 'recharts'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { chartMoneyFormatter, formatMoney, round2 } from '@shared/money'
import { currentMonthRange, useCardFeeReport, usePaymentReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { Panel } from './Panel'
import { ReportEmpty, ReportError, ReportLoading } from '@/pages/reports/ReportState'

const METHOD_KEY: Record<string, string> = {
  cash: 'pos.receipt.cash',
  card: 'pos.receipt.card',
  split: 'pos.receipt.split'
}
const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const

/** §2.6 — current month doughnut + table + net card row. Fixed window, no filter. */
export function PaymentPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const range = useMemo(() => currentMonthRange(), [])
  const pay = usePaymentReport(range)
  const fees = useCardFeeReport(range)
  const currency = settings?.general.currency ?? 'USD'

  const config = { revenue: { label: t('reportPage.revenue'), color: 'var(--chart-2)' } } satisfies ChartConfig
  const data = pay.data
  const total = round2((data ?? []).reduce((s, r) => s + r.revenue, 0))

  return (
    <Panel title={t('dashboard.payment')}>
      {pay.isPending ? (
        <ReportLoading />
      ) : pay.isError ? (
        <ReportError onRetry={() => void pay.refetch()} />
      ) : !data || data.length === 0 ? (
        <ReportEmpty />
      ) : (
        <>
          <ChartContainer config={config} className="h-64 w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent formatter={chartMoneyFormatter(currency)} />} />
              <Pie data={data} dataKey="revenue" nameKey="method" innerRadius={48}>
                {data.map((r, i) => (
                  <Cell key={r.method} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend formatter={(v: string) => t(METHOD_KEY[v] ?? 'pos.receipt.split', { defaultValue: v })} />
            </PieChart>
          </ChartContainer>
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
              {fees.data && fees.data.cardRevenue > 0 && (
                <TableRow>
                  <TableCell className="italic">
                    {t('reportPage.netCard')} ({fees.data.feePercent}%)
                  </TableCell>
                  <TableCell className="text-right italic">{formatMoney(fees.data.netCard, currency)}</TableCell>
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
        </>
      )}
    </Panel>
  )
}
