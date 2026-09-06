import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { subDays } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { format } from 'date-fns'
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
import { toISO } from '@shared/dates'
import type { RangeInput } from '@shared/analytics'
import { useWeekdayAverages } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { Panel } from './Panel'
import { ReportEmpty, ReportError, ReportLoading } from '@/pages/reports/ReportState'

type Period = 'week' | 'month' | 'year'

function rangeFor(period: Period): RangeInput {
  const now = new Date()
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365
  const from = subDays(now, days - 1)
  from.setHours(0, 0, 0, 0)
  return { from: toISO(from), to: now.toISOString() }
}

/** Monday-first short weekday labels in the app language. */
function weekdayLabels(locale: 'tr' | 'en'): string[] {
  const base = new Date(2026, 8, 7) // a Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return format(d, 'EEE', { locale: locale === 'tr' ? tr : enUS })
  })
}

/** §2.4 — dual-axis grouped bars: average count (left) and revenue (right). */
export function WeekdayPanel(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { data: settings } = useSettings()
  const [period, setPeriod] = useState<Period>('month')
  const { data, isPending, isError, refetch } = useWeekdayAverages(rangeFor(period))
  const currency = settings?.general.currency ?? 'USD'
  const labels = weekdayLabels(i18n.language === 'tr' ? 'tr' : 'en')

  const config = {
    avgSales: { label: t('dashboard.count'), color: 'var(--chart-2)' },
    avgRevenue: { label: t('dashboard.avgRevenue'), color: 'var(--chart-4)' }
  } satisfies ChartConfig

  return (
    <Panel
      title={t('dashboard.weekday')}
      controls={
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">{t('dashboard.periodWeek')}</SelectItem>
            <SelectItem value="month">{t('dashboard.periodMonth')}</SelectItem>
            <SelectItem value="year">{t('dashboard.periodYear')}</SelectItem>
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
          <BarChart data={data.map((d) => ({ name: labels[d.weekday], ...d }))}>
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
