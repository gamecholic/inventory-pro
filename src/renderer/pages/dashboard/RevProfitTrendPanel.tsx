import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { chartMoneyFormatter, formatMoney } from '@shared/money'
import { useRevenueTrend } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { Panel } from './Panel'
import { ReportEmpty, ReportError, ReportLoading } from '@/pages/reports/ReportState'

/** §2.9 — fixed 6-month grouped revenue/profit bars. */
export function RevProfitTrendPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data, isPending, isError, refetch } = useRevenueTrend()
  const currency = settings?.general.currency ?? 'USD'

  const config = {
    revenue: { label: t('reportPage.revenue'), color: 'var(--chart-2)' },
    profit: { label: t('reportPage.profit'), color: 'var(--chart-4)' }
  } satisfies ChartConfig

  return (
    <Panel title={t('dashboard.revProfitTrend')}>
      {isPending ? (
        <ReportLoading />
      ) : isError ? (
        <ReportError onRetry={() => void refetch()} />
      ) : !data || data.every((d) => d.revenue === 0) ? (
        <ReportEmpty />
      ) : (
        <ChartContainer config={config} className="h-64 w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={64} />
            <ChartTooltip content={<ChartTooltipContent formatter={chartMoneyFormatter(currency)} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
            <Bar dataKey="profit" fill="var(--color-profit)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </Panel>
  )
}
