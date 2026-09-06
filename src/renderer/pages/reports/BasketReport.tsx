import { useTranslation } from 'react-i18next'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatMoney, round2 } from '@shared/money'
import type { RangeInput } from '@shared/analytics'
import { useBasketReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

/** Daily revenue bars with average-basket-value line. */
export function BasketReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data, isPending, isError, refetch } = useBasketReport(range)
  const currency = settings?.general.currency ?? 'USD'

  const config = {
    revenue: { label: t('reportPage.revenue'), color: 'var(--chart-2)' },
    avgValue: { label: t('reportPage.avgValue'), color: 'var(--chart-4)' }
  } satisfies ChartConfig

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <ReportEmpty />

  const totalSales = data.reduce((s, d) => s + d.sales, 0)
  const totalItems = data.reduce((s, d) => s + d.items, 0)
  const totalRevenue = round2(data.reduce((s, d) => s + d.revenue, 0))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.basket')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.basketDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t('reportPage.sales')}</p>
            <p className="text-2xl font-bold">{totalSales}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t('reportPage.avgItems')}</p>
            <p className="text-2xl font-bold">{totalSales > 0 ? (totalItems / totalSales).toFixed(1) : '0.0'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t('reportPage.avgValue')}</p>
            <p className="text-2xl font-bold">
              {totalSales > 0 ? formatMoney(round2(totalRevenue / totalSales), currency) : formatMoney(0, currency)}
            </p>
          </CardContent>
        </Card>
      </div>
      <ChartContainer config={config} className="h-72 w-full">
        <ComposedChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} width={64} />
          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={64} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatMoney(Number(v), currency)} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar yAxisId="left" dataKey="revenue" fill="var(--color-revenue)" radius={4} />
          <Line yAxisId="right" type="monotone" dataKey="avgValue" stroke="var(--color-avgValue)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
