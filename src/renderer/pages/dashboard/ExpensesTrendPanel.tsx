import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { chartMoneyFormatter, formatMoney } from '@shared/money'
import { useMonthlyExpensesTrend } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { Panel } from './Panel'
import { ReportEmpty, ReportError, ReportLoading } from '@/pages/reports/ReportState'

/** §2.8 — fixed 6-month expense bars. */
export function ExpensesTrendPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data, isPending, isError, refetch } = useMonthlyExpensesTrend()
  const currency = settings?.general.currency ?? 'USD'

  const config = { total: { label: t('reportPage.expenses'), color: 'var(--chart-4)' } } satisfies ChartConfig

  return (
    <Panel title={t('dashboard.expensesTrend')}>
      {isPending ? (
        <ReportLoading />
      ) : isError ? (
        <ReportError onRetry={() => void refetch()} />
      ) : !data || data.every((d) => d.total === 0) ? (
        <ReportEmpty />
      ) : (
        <ChartContainer config={config} className="h-64 w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={64} />
            <ChartTooltip content={<ChartTooltipContent formatter={chartMoneyFormatter(currency)} />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </Panel>
  )
}
