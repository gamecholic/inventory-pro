import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatMoney } from '@shared/money'
import { useMonthlyAverages } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { Panel } from './Panel'
import { ReportEmpty, ReportError, ReportLoading } from '@/pages/reports/ReportState'

/** §2.5 — same dual-axis concept per calendar month, current/previous year. */
export function MonthlyPanel(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { data: settings } = useSettings()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear)
  const { data, isPending, isError, refetch } = useMonthlyAverages(year)
  const currency = settings?.general.currency ?? 'USD'
  const locale = i18n.language === 'tr' ? tr : enUS

  const config = {
    avgSales: { label: t('dashboard.count'), color: 'var(--chart-2)' },
    avgRevenue: { label: t('dashboard.avgRevenue'), color: 'var(--chart-4)' }
  } satisfies ChartConfig

  return (
    <Panel
      title={t('dashboard.monthly')}
      controls={
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={String(currentYear)}>{t('dashboard.thisYear')}</SelectItem>
            <SelectItem value={String(currentYear - 1)}>{t('dashboard.lastYear')}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {isPending ? (
        <ReportLoading />
      ) : isError ? (
        <ReportError onRetry={() => void refetch()} />
      ) : !data || data.every((d) => d.sales === 0) ? (
        <ReportEmpty />
      ) : (
        <ChartContainer config={config} className="h-64 w-full">
          <BarChart
            data={data.map((d) => ({
              name: format(new Date(year, d.month, 1), 'MMM', { locale }),
              ...d
            }))}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} width={48} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={64} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, name) =>
                    name === 'avgRevenue' ? formatMoney(Number(v), currency) : Number(v).toFixed(1)
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar yAxisId="left" dataKey="avgSales" fill="var(--color-avgSales)" radius={4} />
            <Bar yAxisId="right" dataKey="avgRevenue" fill="var(--color-avgRevenue)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </Panel>
  )
}
