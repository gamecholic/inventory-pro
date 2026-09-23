import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import { chartPieMoneyFormatter, formatMoney, round2 } from '@shared/money'
import type { RangeInput } from '@shared/analytics'
import { useCardFeeReport, usePaymentReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

const METHOD_KEY: Record<string, string> = {
  cash: 'pos.receipt.cash',
  card: 'pos.receipt.card',
  split: 'pos.receipt.split'
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const

/** §8.3 — donut chart + table with net-card row and Total footer. */
export function PaymentReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data, isPending, isError, refetch } = usePaymentReport(range)
  // Card-leg truth (card total + split cardAmount) lives in the card-fee
  // report — the payment breakdown groups split sales under "split", so
  // deriving the fee from it alone undercounts. See getCardFeeReport.
  const { data: feeData, refetch: refetchFees } = useCardFeeReport(range)
  const currency = settings?.general.currency ?? 'USD'

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => { void refetch(); void refetchFees(); }} />
  if (!data || data.length === 0) return <ReportEmpty />

  const total = round2(data.reduce((s, r) => s + r.revenue, 0))
  const cardRevenue = feeData ? feeData.cardRevenue : 0
  const feePercent = feeData ? feeData.feePercent : (settings?.general.cardFeePercent ?? 0)
  const feeAmount = feeData ? feeData.feeAmount : null
  const netCard = feeData ? feeData.netCard : null

  const config = { revenue: { label: t('reportPage.revenue'), color: 'var(--chart-2)' } } satisfies ChartConfig
  const chartData = data.map((r) => ({
    method: r.method,
    name: t(METHOD_KEY[r.method] ?? 'pos.receipt.split', { defaultValue: r.method }),
    revenue: r.revenue,
    share: r.share
  }))
  const shareByName = new Map(chartData.map((d) => [d.name, d.share]))
  const pieFormatter = chartPieMoneyFormatter(currency)
  const tooltipFormatter = (value: unknown, _name: unknown, item?: { payload?: { name?: unknown } }): string => {
    const base = pieFormatter(value, _name, item)
    const raw = item?.payload?.name
    const share = typeof raw === 'string' ? shareByName.get(raw) : undefined
    return share === undefined ? base : `${base} (${share.toFixed(1)}%)`
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.payment')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.paymentDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <ChartContainer config={config} className="h-64 w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent formatter={tooltipFormatter} />} />
          <Pie data={chartData} dataKey="revenue" nameKey="name" innerRadius={48}>
            {chartData.map((d, i) => (
              <Cell key={d.method} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
      {feeAmount !== null && netCard !== null && feeAmount > 0 && cardRevenue > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {t('reportPage.feeCallout', {
                fee: formatMoney(feeAmount, currency),
                feePercent,
                net: formatMoney(netCard, currency)
              })}
            </p>
            <p className="text-2xl font-bold text-destructive">{formatMoney(feeAmount, currency)}</p>
          </CardContent>
        </Card>
      )}
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
          {netCard !== null && cardRevenue > 0 && (
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
